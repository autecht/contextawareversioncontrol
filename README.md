# Context Aware Version Control README

This is Context Aware Version Control, an extension designed to help you easily navigate and understand git repositories. It uses context such as changes since the last commit, authors responsible for changes, and the user's active location to display commits relevant to the user and visualize the relevance of commits responsible for each line of the repository.

## Running The Extension
1. Clone or open this repository in VS Code.
2. Press `F5` to launch the Extension Development Host with your extension activated.
3. Your extension will be loaded in the new window, ready for testing and development.

## Features

### Relevance Metrics

The extension is centered around relevance metrics to determine the relevance to the user of commits and the individual changes they consist of. The metrics are as follows:

1. Time: how recent the commit is relative to other commits in the repository.
2. Location: how close change was to current location of user's text cursor. If the change is in a different file, then this metric is 0.
3. Author: how consistently author of the commit matches the authors responsible for commits in the file the user is focusing on, scaled by number of lines in the file. For example, this metric would be incremented if the the author of the commit was `abc` and the author responsible for the first line in the file the user is focused on was also `abc`.
4. Commit Message Semantic Similarity: how often tokens from the commit message appeared near the current location of the user's text cursor (+/- 20 lines from the cursor).
5. Commit Changes Semantic Similarity: how often tokens near the current location of the user's text cursor appeared in changes made by the commit.

### Relevant Commits

Using the `Show Relevant Commits` command (accessible by clicking typing `>` into the search bar at the top of VS Code followed by `Show Relevant Commits` and pressing the `Enter` key) creates a tab displaying all commits in the repository branch sorted by relevance descending. 

![Show Relevant Commits](/images/command-search.png)

The tile for each commit shows the abbreviated hash of the commit, the commit message, and the 10 most relevant changes in the commit. Each change displayed is highlighted to indicate whether it was an addition or deletion and labeled with the file the change is in.

![Relevant Commits Webview](/images/relevent-commits-view.png)

#### Checkout
By clicking on the `Checkout` button, the user can checkout that commit (the equivalent of `git stash` followed by `git checkout <hash>`).

#### Diff Files
Clicking on the background of the commit tile opens a VS Code diff file for each file changed by the commit showing changes since that commit.

#### Comments
Users can easily add, delete, and view comments associated with each commit, providing an easy way to keep track of thoughts and in the future to communicate with other users (though currently these commits are stored in a local database, so users can only see comments made on the device they are using).

### Responsible Commit Navigation

When users hover over a line, the commit responsible for that line appears.

![Hover Display](/images/commit-on-hover.png)

By clicking `View Commit`, users can open a tab displaying that commit.

![Single Commit View](/images/single-commit.png)

### Line Relevance Visualization

Using the `Visualize Lines` command opens a webview showing every directory in the repository. Clicking on any directory will display a visualization for each file in the directory -- each line in the file is displayed and highlighted based on the relevance of the commit responsible for that line, where red is highly relevant and blue is highly irrelevant.

GRID_VIEW_VISUALIZATION
![Line Relevance Grid](/images/grid-view.png)


#### Metrics
You can switch between highlighting lines by relevance as determined by the classic relevance metrics or recency alone by clicking on the `relevance` and `recency` buttons, respectively.

#### Semantic Zooming
Initially, only lines at the lowest level of indentation in the file are shown. You can "zoom in" to show lines at the next level of indentation by pressing the ` +` button and zoom back out a level by pressing the ` -` button. Similarly, dragging the handle at the bottom of the file downwards zooms in semantically and dragging it upwards zooms out.

![Semantically Zoomed File](/images/resized-file.png)

#### Resizing

Files can be resized vertically without zooming semantically by dragging the bottom right of the file upwards or downwards.

#### Rearranging

Dragging a file over another file switches the locations of the files in the grids to allow users to focus on files important to them.


## Requirements

This extension relies on a database to store user comments. Currently, it connects to a local database you need to initialize.

First, make sure you've downloaded PostgreSQL. You can use the installers [here](https://www.postgresql.org/download/).

Now, open a terminal in the `db` folder in `/src/db`. To open postgres, run the command `psql -U postgres` This will open an interactive terminal -- you should see `postgres=#`.

Next, from the interactive terminal, create the database by typing `CREATE DATABASE context_aware_version_control;`.

You can connect to the database by typing `\c context_aware_version_control` -- now you should see `context_aware_version_control=#`.

Finally, create the database schema to store comments by typing `\i schema.sql`.

That's it! If you type `\dt`, you should see a "comments" table. To exit the interactive terminal, type `exit`.
