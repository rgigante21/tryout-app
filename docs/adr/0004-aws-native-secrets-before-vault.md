# AWS-native secrets before Vault

Rosterline will begin with AWS Secrets Manager for runtime secrets, SSM Parameter Store for non-secret configuration, and short-lived GitHub Actions access through AWS OIDC rather than operating HashiCorp Vault. This minimizes cost and removes the security burden of running a highly available Vault control plane while the team is one human plus AI agents; Vault remains a future option when scale, multi-cloud operation, dynamic credentials, PKI, or policy complexity provides a concrete reason to adopt it.
