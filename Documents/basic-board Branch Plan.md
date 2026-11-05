# Plan for the basic-board branch

This document roughly covers the changes (organized in sections by the commits they'll be made within) to complete this branch. Like Requirements.md, this is a high level document, not a highly technical one.

## Basic card

When the Note card button is clicked, a simple element is created that the user can drag around and resize.

## Board

Implement the whole Board section from Requirements.md, using the basic card to verify resizing on move and zoom.

## Note Card

Implement the whole Note Card section from Requirements.md replacing, replacing the basic card created earlier. Make sure the card interacts with the board correctly.

## Basic Collaboration

If multiple users have the same board open at the same time, they can see each other in real time (as close as reasonably possible of course) moving the cards and writing text in the notes. This should be done in anticipation of the full Collaboration section from Requirements.md (don't make decisions that undermine the future implementation but rather make room for it to naturally be added later), since the full implementation will come later so other details (like indicators or synced cursors) can be left out for now.

## Tests

That's it for this branch, so add the necessary E2E tests to verify everything works and future work doesn't break the old work.
