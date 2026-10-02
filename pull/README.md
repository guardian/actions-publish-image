# `guardian/actions-ecr/pull`

A ([composite](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action)) GitHub Action to pull a Docker image from AWS ECR.

See [`action.yml`](action.yml) for details on the available inputs and outputs.

## Permissions
This Action requires the following permissions:
- `id-token: write` - to obtain an OIDC token for authenticating with AWS ECR

## Example usage

> [!NOTE]
> To prevent leakage of AWS Credentials it is recommended to run this action in an isolated job.

### Pulling your own (main branch) image

```yaml
name: Integration tests
on:
  pull_request:
  workflow_dispatch:
  push:
    branches:
      - main
jobs:
  pull-image:
    runs-on: ubuntu-24.04-arm
    permissions:
      id-token: write
    steps:      
      # Find the latest version here - https://github.com/guardian/actions-ecr/releases.
      - uses: guardian/actions-ecr/pull@vX.Y.Z
        id: pull-image
        with:
          appName: my-app
          imageIdentifier: branch-main
          roleArn: ${{ secrets.GU_ARTIFACTS_ROLE_ARN }}
      - name: Run image from main
        env:
          IMAGE_URI: ${{ steps.pull-image.outputs.imageUri }}
        run: docker run "$IMAGE_URI"
```

### Pulling another repository's (main branch) image

```yaml
name: Integration tests
on:
  pull_request:
  workflow_dispatch:
  push:
    branches:
      - main
jobs:
  pull-image:
    runs-on: ubuntu-24.04-arm
    permissions:
      id-token: write
    steps:      
      # Find the latest version here - https://github.com/guardian/actions-ecr/releases.
      - uses: guardian/actions-ecr/pull@vX.Y.Z
        id: pull-dcr-image
        with:
          appName: dotcom-rendering
          githubRepository: guardian/dotcom-rendering
          imageIdentifier: branch-main
          roleArn: ${{ secrets.GU_ARTIFACTS_ROLE_ARN }}
      - name: Run DCR
        env:
          IMAGE_URI: ${{ steps.pull-dcr-image.outputs.imageUri }}
        run: docker run "$IMAGE_URI"
```
