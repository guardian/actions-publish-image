# `guardian/actions-ecr/push`

A ([composite](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action)) GitHub Action to tag and push a Docker image to Amazon ECR with the following tags:
- `branch-<BRANCH_NAME>` (e.g. `branch-main`)
- `build-<BUILD_NUMBER>` (e.g. `build-123`)
- `lifecycle-<BRANCH_NAME>-<BUILD_NUMBER>` (e.g. `lifecycle-main-123`). This tag is used in lifecycle rules defined in https://github.com/guardian/riffraff-platform to automatically delete old images.

See [`action.yml`](action.yml) for details on the available inputs and outputs.

## Permissions
This Action requires the following permissions:
- `id-token: write` - to obtain an OIDC token for authenticating with AWS ECR
- `pull-requests: write` - to comment on pull requests

The IAM Role passed to `roleArn` must also have permissions to push to ECR.
This can be obtained by raising a PR to https://github.com/guardian/riffraff-platform.

## Example usage

> [!NOTE]
> To prevent leakage of AWS Credentials it is recommended to run this action in an isolated job.

```yaml
name: CI
on:
  pull_request:
  workflow_dispatch:
  push:
    branches:
      - main
jobs:
  push-image:
    runs-on: ubuntu-latest
    needs:
      - facts
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6.0.3
      
      - name: Build image
        run: docker build -t ${{ github.repository }}:latest .
      
      - name: Publish image to ECR
        # Find the latest version here - https://github.com/guardian/actions-ecr/releases.
        uses: guardian/actions-ecr/push@vX.Y.Z
        with:
          appName: my-app
          roleArn: ${{ secrets.GU_ARTIFACTS_ROLE_ARN }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

By default, images are published to `<organisation>/<repository>/<repository>`, in the case of repositories with multiple apps the `appName` property can be used to push to `<organisation>/<repository>/<appName>`.