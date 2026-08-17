# `guardian/actions-publish-image`

You may wish to skip to the [migration](#Migration) section below.

A ([composite](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action)) GitHub Action to tag and push a Docker image to Amazon ECR with the following tags:
- `branch-<BRANCH_NAME>` (e.g. `branch-main`)
- `build-<BUILD_NUMBER>` (e.g. `build-123`)
- `commit-<COMMIT_SHA>` (e.g. `commit-abc123`)
- `lifecycle-<BRANCH_NAME>-<BUILD_NUMBER>` (e.g. `lifecycle-main-123`). This tag is used in lifecycle rules defined in https://github.com/guardian/riffraff-platform to automatically delete old images.

See [`action.yml`](action.yml) for details on the available inputs and outputs.

## Permissions
This Action requires the following permissions:
- `id-token: write` - to obtain an OIDC token for authenticating with AWS ECR

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
    steps:
      - uses: actions/checkout@v6.0.3
      
      - name: Build image
        run: docker build -t ${{ github.repository }}:latest .
      
      - name: Publish image to ECR
        # Find the latest version here - https://github.com/guardian/actions-publish-image/releases.
        uses: guardian/actions-publish-image@v0.0.1
        with:
          roleArn: ${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}
          branch-name: ${{ needs.facts.outputs.branchName }}
          build-number: ${{ needs.facts.outputs.buildNumber }}
          commit-sha: ${{ needs.facts.outputs.commitSha }}
```

# Migration

Many repos currently publish to an AWS RCS with this pattern: get creds, login to docker, do work, push image.

Those aws creds are now available to any build step after the initial step, which can include
code running in a build/test step, which can contain a supply chain attack.

To swap out "docker login / aws ecr push" for the new action:

* Add the repo to the [accessForEcr list](https://github.com/guardian/riffraff-platform/blob/73b459a50b53d48d1596851629127ff2a194e993/packages/common/src/access.ts#L680-L693)
* Remove the aws creds fetch, docker login, and docker push actions
* Add this single action
* Change the ECR deploy source to ...?

Example:

## Before

```
      ### FETCHES AWS CREDS ONTO THE BUILD SERVER - WHICH ARE THEN AVAILABLE TO ANY FUTURE BUILD STEP ###
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-region: <region>
          role-to-assume: XXX
          role-session-name: XXX

      ### THE ONLY STEP REQUIRING AWS CREDS ###
      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v1
        with:
          mask-password: 'true'

...

      - name: Tag docker image
        run:  docker tag guardianmultimedia/my-app:${{ env.GITHUB_RUN_NUMBER }} <account>.dkr.ecr.<region>.amazonaws.com/my-app:${{ env.GITHUB_RUN_NUMBER }}

      - name: Push docker image
        run: docker push  <account>.dkr.ecr.<region>.amazonaws.com/my-app:${{ env.GITHUB_RUN_NUMBER }}
```

And then deploy from that ECR location within their account.

## After:

```
      ### FETCHES AND USES AWS CREDS WITHOUT PERSISTENCE ###
      - name: Publish image to ECR
        uses: guardian/actions-publish-image@v0.0.1
        with:
          roleArn: ${{ secrets.GU_RIFF_RAFF_ROLE_ARN }}
          branch-name: ${{ needs.facts.outputs.branchName }}
          build-number: ${{ needs.facts.outputs.buildNumber }}
          commit-sha: ${{ needs.facts.outputs.commitSha }}
```

And then deploy from the `deployTools` ECR location.
