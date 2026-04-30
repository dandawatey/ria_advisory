"""
services/vault.py — Credential Vault Service
Agent: Rohan_Backend_003  |  Ticket: IC-3
Stores ONLY vault path references in DB — never plaintext secrets.
Secrets live in the vault backend (env / Azure Key Vault / AWS Secrets Manager).

Security rules (Rule 05):
  - Never log secret values
  - Never return secret in API responses
  - vault_secret_ref is the only thing stored in dim_erp_credential
"""
from __future__ import annotations
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Supported backends
BACKEND_ENV = "env"
BACKEND_AZURE = "azure"
BACKEND_AWS = "aws"

SUPPORTED_BACKENDS = {BACKEND_ENV, BACKEND_AZURE, BACKEND_AWS}


class VaultService:
    """
    Credential vault abstraction.

    Usage:
        vault = VaultService(backend="env")
        ref = vault.make_ref(erp_source_id=1, credential_type="oauth2")
        vault.store(ref, plaintext_secret)   # store in backend
        secret = vault.retrieve(ref)          # retrieve when needed
        vault.rotate(ref, new_secret)         # rotate
        vault.delete(ref)                     # remove
    """

    def __init__(self, backend: str = BACKEND_ENV):
        if backend not in SUPPORTED_BACKENDS:
            raise ValueError(
                f"Unsupported vault backend: {backend!r}. "
                f"Choose from: {sorted(SUPPORTED_BACKENDS)}"
            )
        self.backend = backend
        self._env_store: dict[str, str] = {}  # in-process store for env backend
        logger.info("VaultService initialised with backend=%s", backend)

    # ── Public API ────────────────────────────────────────────────────────────

    def make_ref(self, erp_source_id: int, credential_type: str) -> str:
        """Build a canonical vault reference path for this credential."""
        return f"erp/{erp_source_id}/{credential_type}"

    def store(self, ref: str, secret: str) -> None:
        """Store secret at ref. Secret is NEVER logged."""
        logger.debug("VaultService.store ref=%s [secret redacted]", ref)
        if self.backend == BACKEND_ENV:
            self._env_store[ref] = secret
        elif self.backend == BACKEND_AZURE:
            self._store_azure(ref, secret)
        elif self.backend == BACKEND_AWS:
            self._store_aws(ref, secret)

    def retrieve(self, ref: str) -> Optional[str]:
        """Retrieve secret by ref. Returns None if not found."""
        logger.debug("VaultService.retrieve ref=%s", ref)
        if self.backend == BACKEND_ENV:
            return self._env_store.get(ref)
        elif self.backend == BACKEND_AZURE:
            return self._retrieve_azure(ref)
        elif self.backend == BACKEND_AWS:
            return self._retrieve_aws(ref)
        return None

    def rotate(self, ref: str, new_secret: str) -> None:
        """Replace existing secret. Old secret is overwritten. Never logged."""
        logger.debug("VaultService.rotate ref=%s [new secret redacted]", ref)
        self.store(ref, new_secret)

    def delete(self, ref: str) -> None:
        """Remove secret from vault."""
        logger.debug("VaultService.delete ref=%s", ref)
        if self.backend == BACKEND_ENV:
            self._env_store.pop(ref, None)
        elif self.backend == BACKEND_AZURE:
            self._delete_azure(ref)
        elif self.backend == BACKEND_AWS:
            self._delete_aws(ref)

    # ── Azure Key Vault backend ───────────────────────────────────────────────

    def _store_azure(self, ref: str, secret: str) -> None:
        try:
            from azure.keyvault.secrets import SecretClient
            from azure.identity import DefaultAzureCredential
            vault_url = os.environ["AZURE_VAULT_URL"]
            client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential())
            safe_name = ref.replace("/", "--")
            client.set_secret(safe_name, secret)
        except ImportError:
            raise RuntimeError("azure-keyvault-secrets not installed. pip install azure-keyvault-secrets azure-identity")

    def _retrieve_azure(self, ref: str) -> Optional[str]:
        try:
            from azure.keyvault.secrets import SecretClient
            from azure.identity import DefaultAzureCredential
            from azure.core.exceptions import ResourceNotFoundError
            vault_url = os.environ["AZURE_VAULT_URL"]
            client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential())
            safe_name = ref.replace("/", "--")
            try:
                return client.get_secret(safe_name).value
            except ResourceNotFoundError:
                return None
        except ImportError:
            raise RuntimeError("azure-keyvault-secrets not installed.")

    def _delete_azure(self, ref: str) -> None:
        try:
            from azure.keyvault.secrets import SecretClient
            from azure.identity import DefaultAzureCredential
            vault_url = os.environ["AZURE_VAULT_URL"]
            client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential())
            safe_name = ref.replace("/", "--")
            client.begin_delete_secret(safe_name)
        except ImportError:
            raise RuntimeError("azure-keyvault-secrets not installed.")

    # ── AWS Secrets Manager backend ───────────────────────────────────────────

    def _store_aws(self, ref: str, secret: str) -> None:
        try:
            import boto3
            client = boto3.client("secretsmanager")
            prefix = os.environ.get("AWS_SECRET_ARN_PREFIX", "ria-advisory")
            name = f"{prefix}/{ref}"
            try:
                client.create_secret(Name=name, SecretString=secret)
            except client.exceptions.ResourceExistsException:
                client.put_secret_value(SecretId=name, SecretString=secret)
        except ImportError:
            raise RuntimeError("boto3 not installed. pip install boto3")

    def _retrieve_aws(self, ref: str) -> Optional[str]:
        try:
            import boto3
            from botocore.exceptions import ClientError
            client = boto3.client("secretsmanager")
            prefix = os.environ.get("AWS_SECRET_ARN_PREFIX", "ria-advisory")
            name = f"{prefix}/{ref}"
            try:
                return client.get_secret_value(SecretId=name)["SecretString"]
            except ClientError:
                return None
        except ImportError:
            raise RuntimeError("boto3 not installed.")

    def _delete_aws(self, ref: str) -> None:
        try:
            import boto3
            client = boto3.client("secretsmanager")
            prefix = os.environ.get("AWS_SECRET_ARN_PREFIX", "ria-advisory")
            name = f"{prefix}/{ref}"
            client.delete_secret(SecretId=name, ForceDeleteWithoutRecovery=True)
        except ImportError:
            raise RuntimeError("boto3 not installed.")
