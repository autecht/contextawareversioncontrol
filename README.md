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

### Responsible Commit Navigation

### Line Relevance Visualization


## Requirements

This extension relies on a database to store user comments. Currently, it connects to a local database you need to initialize.

First, make sure you've downloaded PostgreSQL. You can use the installers [here](https://www.postgresql.org/download/).

Now, open a terminal in the `db` folder in `/src/db`. To open postgres, run the command `psql -U postgres` This will open an interactive terminal -- you should see `postgres=#`.

Next, from the interactive terminal, create the database by typing `CREATE DATABASE context_aware_version_control;`.

You can connect to the database by typing `\c context_aware_version_control` -- now you should see `context_aware_version_control=#`.

Finally, create the database schema to store comments by typing `\i schema.sql`.

That's it! If you type `\dt`, you should see a "comments" table. To exit the interactive terminal, type `exit`.


## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.
