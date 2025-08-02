// Global variables and setup ==
const vscode = acquireVsCodeApi();
window.addEventListener('message', (event) => {
  console.log("Received message: ", event.data);
  if (event.data.command === 'updateComments') {
    refreshComments(event);
  }
});

/**
 * Replaces the comments section of a commit in the DOM with the provided comments.
 *
 * @param {command: string, hash: string, comments: Comment[]} event: event with new comments and hash of associated commit.
 */
function refreshComments(event) {
  const hash = event.data.hash;
  const comments = event.data.comments;
  const commentsContainer = document.getElementById(`${hash}-comments`);
  if (commentsContainer) {
    commentsContainer.innerHTML = comments.map(comment => `<div class="comment">
          <p><strong>${comment.username}:</strong> ${comment.comment}</p>
          <button class="button" onclick="deleteComment('${hash}', '${comment.id}')">Delete Comment</button>
        </div>`).join('');
  }
}


// == Extension Messengers ==
/**
 * Messages the extension to open diff view of a files changed since a commit
 *
 * @param string hash: hash of commit
 */
function openDiffFile(hash) {
  vscode.postMessage({
    command: 'openDiffFile',
    hash: hash
  });
}

/**
 * Messages extension to checkout commit.
 *
 * @param string hash: hash of commit to checkout
 */
function checkoutCommit(hash) {
  vscode.postMessage({
    command: 'checkoutCommit',
    hash: hash
  });
}

/**
 * Message extension to post comment to commit.
 *
 * @param string hash: hash of commit comment was posted on.
 */
function addComment(hash) {
  const commentInput = document.getElementById(`${hash}-comment`);
  const comment = commentInput.value;

  if (comment) {
    vscode.postMessage({
      command: 'addComment',
      hash: hash,
      comment: comment
    });
    commentInput.value = ''; // Clear the input field after submission
  } else {
    alert('Comment cannot be empty');
  }
}

/**
 * Message extension to delete comment from database
 *
 * @param string hash: hash of commit comment was posted on
 * @param string id: id of comment in database
 */
function deleteComment(hash, id) {
  console.log("Deleting comment with hash: ", hash, " and id: ", id);
    vscode.postMessage({
      command: 'deleteComment',
      hash: hash,
      id:id
    });
}

