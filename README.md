# `guardian/actions-publish-image`

A ([composite](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action)) GitHub Action to tag and push a Docker image to Amazon ECR with the following tags:
- `branch-<BRANCH_NAME>` (e.g. `branch-main`)
- `build-<BUILD_NUMBER>` (e.g. `build-123`)
- `commit-<COMMIT_SHA>` (e.g. `commit-abc123`)
- `lifecycle-<BRANCH_NAME>-<BUILD_NUMBER>` (e.g. `lifecycle-main-123`). This tag is used in lifecycle rules defined in https://github.com/guardian/riffraff-platform to automatically delete old images.

See [`action.yml`](action.yml) for details on the available inputs and outputs.

## Permissions
This Action requires the following permissions:
- `id-token: write` - to obtain an OIDC token for authenticating with AWS ECR
- `pull-requests: write` - to comment on pull requests

The IAM Role passed to `roleArn` must also have permissions to push to ECR.
This can be obtained by raising a PR to https://github.com/guardian/riffraff-platform.

## Example usage
It is recommended to use this Action in conjunction with [`guardian/actions-build-facts`](https://github.com/guardian/actions-build-facts) and to run in isolated jobs.

```yaml
name: CI
on:
  pull_request:
  workflow_dispatch:
  push:
    branches:
      - main
jobs:
  # Obtain build facts
  facts:
    runs-on: ubuntu-slim
    permissions: {} # This job doesn't need any permissions.
    outputs:
      branchName: ${{ steps.get-build-facts.outputs.branchName }}
      buildNumber: ${{ steps.get-build-facts.outputs.buildNumber }}
      commitSha: ${{ steps.get-build-facts.outputs.commitSha }}
    steps:
      # Find the latest version here - https://github.com/guardian/actions-build-facts/releases.
      - uses: guardian/actions-build-facts@v0.0.1
        id: get-build-facts

  # Now use the facts in your build steps
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
        # Find the latest version here - https://github.com/guardian/actions-publish-image/releases.
        uses: guardian/actions-publish-image@v0.0.1
        with:
          roleArn: ${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}
          branchName: ${{ needs.facts.outputs.branchName }}
          buildNumber: ${{ needs.facts.outputs.buildNumber }}
          commitSha: ${{ needs.facts.outputs.commitSha }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```