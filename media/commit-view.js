const vscode = acquireVsCodeApi();

window.addEventListener('message', (event) => {
  console.log("Received message: ", event.data);
  if (event.data.command === 'updateComments') {
    const hash = event.data.hash;
    const comments = event.data.comments;
    const commentsContainer = document.getElementById(`${hash}-comments`);
    if (commentsContainer) {
      commentsContainer.innerHTML = comments.map(comment => 
        `<div class="comment">
          <p><strong>${comment.username}:</strong> ${comment.comment}</p>
          <button class="button" onclick="deleteComment('${hash}', '${comment.id}')">Delete Comment</button>
        </div>`).join('');
    }
  }
});


function openDiffFile(hash) {
  vscode.postMessage({
    command: 'openDiffFile',
    hash: hash
  });
}

function checkoutCommit(hash) {
  vscode.postMessage({
    command: 'checkoutCommit',
    hash: hash
  });
}


// handle form submission for adding a
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

function deleteComment(hash, id) {
  console.log("Deleting comment with hash: ", hash, " and id: ", id);
    vscode.postMessage({
      command: 'deleteComment',
      hash: hash,
      id:id
    });
}

