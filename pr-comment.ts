import type * as core from '@actions/core'
import type * as github from '@actions/github'

type Payload = {
 core: typeof core
 context: typeof github.context
 github: ReturnType<typeof github.getOctokit>
}

type Config = {
 imageName: string,
 imageDigest: string,
 branchNameInput: string,
 buildNumber: string,
 commitSha: string
}

function getConfig(): Config {
 const {
  IMAGE_NAME,
  IMAGE_DIGEST,
  BRANCH_NAME_INPUT,
  BUILD_NUMBER,
  COMMIT_SHA
 } = process.env;

 // Whilst we're type-casting without checking the contents, these properties are modelled as required fields in action.yml (or have a default), so it should be safe.
 return {
  imageName: IMAGE_NAME as string,
  imageDigest: IMAGE_DIGEST as string,
  branchNameInput: BRANCH_NAME_INPUT as string,
  buildNumber: BUILD_NUMBER as string,
  commitSha: COMMIT_SHA as string
 }
}

async function getPrNumber(payload: Payload, config: Config): Promise<number | undefined> {
 const { context, github } = payload;

 const { pull_request } = context.payload;

 if (pull_request) {
  return Promise.resolve(pull_request.number);
 }

 const { commitSha } = config;

 console.log(`Attempting to get PR number from commit ${commitSha}`);

 const result = await github.rest.repos.listPullRequestsAssociatedWithCommit({
  ...context.repo,
  commit_sha: commitSha,
 });

 const openPrs = result.data.filter(({ state }) => state === 'open');
 const pr = openPrs.find((_) => context.ref === `refs/heads/${_.head.ref}`) ?? openPrs.at(0);

 if (!pr) {
  console.error('Failed to identify PR number from commit.');
  return Promise.resolve(undefined);
 } else {
  console.log(`Identified PR number as ${pr.number} from commit.`);
  return Promise.resolve(pr.number);
 }
}

async function commentOnPr(payload: Payload, config: Config, pullRequestNumber: number): Promise<void> {
 const { context, github } = payload;

 const {
  imageName,
  imageDigest,
  branchNameInput,
  buildNumber,
  commitSha
 } = config;

 const marker = `<!-- guardian/actions-publish-image for ${imageName} -->`;

 const commentBody = [
  '### :rocket: Image pushed to AWS ECR',
  `Image digest: \`${imageDigest}\``,
  '',
  '<details>',
  '<summary>:bug: Run the image locally</summary>',
  '',
  'The following can be used to run the image locally:',
  '',
  '```bash',
  '# Refer to image using the immutable digest. Find alternatives below.',
  `IMAGE_IDENTIFIER="@${imageDigest}"`,
  '',
  '# Refer to image using branch tag',
  `# IMAGE_IDENTIFIER=":branch-${branchNameInput.replaceAll('/', '-')}"`,
  '',
  '# Refer to image using build tag',
  `# IMAGE_IDENTIFIER=":build-${buildNumber}"`,
  '',
  '# Refer to image via the GitHub commit SHA tag',
  `# IMAGE_IDENTIFIER=":sha-${commitSha}"`,
  '',
  '# Set environment variables for the AWS CLI',
  'AWS_PROFILE="<A_PROFILE_FROM_JANUS>"',
  'AWS_DEFAULT_REGION="eu-west-1"',
  '',
  'IMAGE_ACCOUNT_ID=$(aws ssm get-parameter --name /organisation/accounts/deployTools --query "Parameter.Value" --output text)',
  'REGISTRY="${IMAGE_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"',
  `IMAGE="\${REGISTRY}/${context.repo.owner}/${context.repo.repo}\${IMAGE_IDENTIFIER}"`,
  '',
  '# Login to AWS ECR https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html',
  'aws ecr get-login-password | docker login --username AWS --password-stdin $REGISTRY',
  '',
  '# Pull the image',
  'docker pull $IMAGE',
  '',
  `# Run the image. You'll likely need to set additional flags. See https://docs.docker.com/reference/cli/docker/container/run.`,
  `docker run $IMAGE`,
  '```',
  '',
  '</details>',
  '',
  '---',
  '_From [guardian/actions-publish-image](https://github.com/guardian/actions-publish-image)._',
  marker,
 ].join('\n');

 const comments = await github.rest.issues.listComments({
  ...context.repo,
  issue_number: pullRequestNumber,
  per_page: 100
 });

 const previousComments = comments.data.filter((comment) => {
  const fromBot = comment.user?.login === 'github-actions[bot]';
  const fromMe = comment.body?.includes(marker) ?? false;
  return fromBot && fromMe;
 });

 if (previousComments.length === 0) {
  await github.rest.issues.createComment({
   issue_number: pullRequestNumber,
   owner: context.repo.owner,
   repo: context.repo.repo,
   body: commentBody
  });
 } else {
  await Promise.all(
   previousComments.map(async (previousComment) => {
    console.log(`Updating comment with id: ${previousComment.id}.`);
    await github.rest.issues.updateComment({
     ...context.repo,
     comment_id: previousComment.id,
     body: commentBody,
    });
   }),
  );
 }
}

export const main = async (payload: Payload) => {
 const config = getConfig();
 const prNumber = await getPrNumber(payload, config);

 if (prNumber) {
  await commentOnPr(payload, config, prNumber);
 }
}