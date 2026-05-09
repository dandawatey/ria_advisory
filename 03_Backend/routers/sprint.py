import os
import json
import re
from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/sprint", tags=["sprint"])

# Resolve paths from repo root
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_QUEUE_FILE = os.path.join(_REPO_ROOT, '.claude', 'queue', 'sprint_001_queue.jsonl')
_BACKLOG_FILE = os.path.join(_REPO_ROOT, '.claude', 'queue', 'sprint_backlog.jsonl')
_AGENTS_DIR = os.path.join(_REPO_ROOT, '.claude', 'agents')
_TIMELOGS_DIR = os.path.join(_REPO_ROOT, '.claude', 'timelogs')
_FEATURES_DIR = os.path.join(_REPO_ROOT, '.claude', 'features')


def parse_agent_frontmatter(content: str) -> dict:
    """Extract key:value pairs from YAML frontmatter."""
    lines = content.split('\n')
    in_block = False
    result = {}
    for line in lines:
        if line.strip() == '---':
            if not in_block:
                in_block = True
            else:
                break
        elif in_block and ':' in line and not line.startswith(' '):
            k, v = line.split(':', 1)
            result[k.strip()] = v.strip()
    return result


def parse_timelog_table(content: str) -> list:
    """Parse Markdown table into list of dicts."""
    rows = []
    for line in content.split('\n'):
        if line.startswith('|') and '---' not in line:
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if len(cells) >= 6 and cells[0] != 'Ticket':
                rows.append({
                    'ticket': cells[0],
                    'task': cells[1],
                    'start': cells[2],
                    'end': cells[3] if cells[3] not in ['—', '-'] else None,
                    'duration': cells[4] if cells[4] not in ['—', '-'] else None,
                    'status': cells[5] if len(cells) > 5 else 'unknown',
                })
    return rows


def parse_feature_header(content: str) -> dict:
    """Extract title, status, owner, type from first 20 lines."""
    result = {}
    lines = content.split('\n')[:20]
    for line in lines:
        for field in ['Status', 'Owner', 'Type']:
            m = re.match(rf'\*\*{field}:\*\*\s+(.+)', line)
            if m:
                result[field.lower()] = m.group(1).strip()
        title_m = re.match(r'#\s+Feature:\s+[A-Z0-9-]+\s+[—–]\s+(.+)', line)
        if title_m:
            result['title'] = title_m.group(1).strip()
    return result


def load_agents() -> dict:
    """Load agent YAML frontmatter into {agent_id: {display_name, role, ...}}."""
    agents = {}
    if not os.path.isdir(_AGENTS_DIR):
        return agents
    for fname in os.listdir(_AGENTS_DIR):
        if fname.endswith('.md'):
            fpath = os.path.join(_AGENTS_DIR, fname)
            try:
                with open(fpath, 'r') as f:
                    content = f.read()
                fm = parse_agent_frontmatter(content)
                if 'id' in fm:
                    agents[fm['id']] = fm
            except Exception:
                pass
    return agents


def load_timelogs() -> dict:
    """Load per-agent timelogs into {agent_id: [timelog_entries]}."""
    timelogs = {}
    if not os.path.isdir(_TIMELOGS_DIR):
        return timelogs
    for fname in os.listdir(_TIMELOGS_DIR):
        if fname.endswith('.md'):
            agent_id = fname.replace('.md', '')
            fpath = os.path.join(_TIMELOGS_DIR, fname)
            try:
                with open(fpath, 'r') as f:
                    content = f.read()
                timelogs[agent_id] = parse_timelog_table(content)
            except Exception:
                timelogs[agent_id] = []
    return timelogs


@router.get("/summary")
def get_summary():
    """Sprint summary: counts, avg progress, dates."""
    try:
        with open(_QUEUE_FILE, 'r') as f:
            data = json.load(f)
        sprint = data[0] if data else {}
        tickets = sprint.get('tickets', [])

        total = len(tickets)
        done = sum(1 for t in tickets if t.get('status') == 'done')
        in_progress = sum(1 for t in tickets if t.get('status') == 'in_progress')
        pending = sum(1 for t in tickets if t.get('status') == 'pending')
        blocked = sum(1 for t in tickets if t.get('status') == 'blocked')
        avg_progress = sum(t.get('progress_pct', 0) for t in tickets) // max(total, 1)

        return {
            'sprint_id': sprint.get('sprint_id', 1),
            'sprint_name': sprint.get('sprint_name', 'Sprint 1'),
            'sprint_start': sprint.get('sprint_start', '2026-05-08'),
            'sprint_end': sprint.get('sprint_end', '2026-05-15'),
            'total_tickets': total,
            'done': done,
            'in_progress': in_progress,
            'pending': pending,
            'blocked': blocked,
            'avg_progress_pct': avg_progress,
            'last_updated': datetime.utcnow().isoformat() + 'Z',
        }
    except Exception as e:
        return {'error': str(e), 'total_tickets': 0, 'done': 0, 'in_progress': 0, 'pending': 0, 'blocked': 0}


@router.get("/tickets")
def get_tickets():
    """All sprint + backlog tickets."""
    agents = load_agents()
    tickets_list = []

    try:
        with open(_QUEUE_FILE, 'r') as f:
            sprint_data = json.load(f)
        sprint = sprint_data[0] if sprint_data else {}
        for t in sprint.get('tickets', []):
            owner_id = t.get('owner', '')
            owner_display = agents.get(owner_id, {}).get('display_name', owner_id)
            tickets_list.append({
                'ticket_id': t.get('ticket_id', ''),
                'title': t.get('title', ''),
                'status': t.get('status', 'pending'),
                'priority': t.get('priority', 'medium'),
                'effort': t.get('effort', 'M'),
                'progress_pct': t.get('progress_pct', 0),
                'owner': owner_id,
                'owner_display': owner_display,
                'reviewer': t.get('reviewer', 'Kabir_Reviewer_010'),
                'blocker': t.get('blocker'),
                'position': t.get('position', 0),
                'score': None,
                'source': 'sprint',
            })
    except Exception:
        pass

    try:
        with open(_BACKLOG_FILE, 'r') as f:
            backlog_data = json.load(f)
        for t in backlog_data:
            owner_id = t.get('owner', '')
            owner_display = agents.get(owner_id, {}).get('display_name', owner_id)
            tickets_list.append({
                'ticket_id': t.get('ticket_id', ''),
                'title': t.get('feature_name', ''),
                'status': 'queued',
                'priority': 'medium',
                'effort': t.get('effort', 'M'),
                'progress_pct': 0,
                'owner': owner_id,
                'owner_display': owner_display,
                'reviewer': 'Kabir_Reviewer_010',
                'blocker': None,
                'position': t.get('position', 0),
                'score': t.get('score'),
                'source': 'backlog',
            })
    except Exception:
        pass

    return tickets_list


@router.get("/features")
def get_features():
    """All SPARC feature files with parsed headers."""
    features_list = []
    if not os.path.isdir(_FEATURES_DIR):
        return features_list

    feature_re = re.compile(r'(\d{4}-\d{2}-\d{2}T[\d-]+)_([A-Z0-9-]+)_(.+)\.md')
    for fname in sorted(os.listdir(_FEATURES_DIR), reverse=True):
        if not fname.endswith('.md'):
            continue
        match = feature_re.match(fname)
        if not match:
            continue
        created_at_str, ticket_id, slug = match.groups()
        fpath = os.path.join(_FEATURES_DIR, fname)
        try:
            with open(fpath, 'r') as f:
                content = f.read()
            header = parse_feature_header(content)
            features_list.append({
                'filename': fname,
                'ticket_id': ticket_id,
                'slug': slug,
                'created_at': created_at_str.replace('T', ' '),
                'title': header.get('title', ticket_id),
                'status': header.get('status', 'Unknown'),
                'owner': header.get('owner', 'unassigned'),
                'type': header.get('type', 'Feature'),
            })
        except Exception:
            pass

    return features_list


@router.get("/agents")
def get_agents():
    """All agents with timelogs."""
    agents = load_agents()
    timelogs = load_timelogs()

    try:
        with open(_QUEUE_FILE, 'r') as f:
            sprint_data = json.load(f)
        sprint_tickets = {t.get('owner'): t.get('ticket_id') for t in sprint_data[0].get('tickets', [])}
    except Exception:
        sprint_tickets = {}

    agents_list = []
    for agent_id, agent_info in agents.items():
        timelog = timelogs.get(agent_id, [])
        active_ticket = sprint_tickets.get(agent_id)
        active_title = None

        # Try to find active ticket title
        if active_ticket:
            fpath_pattern = os.path.join(_FEATURES_DIR, f'*_{active_ticket}_*')
            import glob
            matches = glob.glob(fpath_pattern)
            if matches:
                try:
                    with open(matches[0], 'r') as f:
                        header = parse_feature_header(f.read())
                    active_title = header.get('title', active_ticket)
                except Exception:
                    active_title = active_ticket

        completed = sum(1 for t in timelog if t.get('status') == 'Done')
        in_prog = sum(1 for t in timelog if t.get('status') == 'In Progress')

        agents_list.append({
            'id': agent_id,
            'display_name': agent_info.get('display_name', agent_id),
            'role': agent_info.get('role', 'unknown'),
            'active_ticket': active_ticket,
            'active_ticket_title': active_title,
            'timelog': timelog,
            'total_sessions': len(timelog),
            'completed_sessions': completed,
            'in_progress_sessions': in_prog,
        })

    return sorted(agents_list, key=lambda x: (x['active_ticket'] is None, x['display_name']))
