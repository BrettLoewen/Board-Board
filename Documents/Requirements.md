# Board Requirements

This document describes the user-level requirements for the boards of Board Board. This is not a technical document, it is an experience document. These are not user stories, but they can be thought of in a similar way.

## Note Card

- N1. Note cards can be created, moved around the board, resized, and deleted
- N2. Text can be written in the note card
- N3. Card and text colour adjusts to match the light mode of the web app, or can be chosen by the user

## Board

- B1. The board resizes to fit every card it holds with a margin at the edge (resizes live as cards move, including being moved by other users remotely)
- B2. I can click and drag with my mouse to move around the board (pan the camera)
- B3. I can scroll to zoom in and out (using the scroll wheel or a slider in the top corner of the screen)
- B4. When opening the board, it adjusts the starting position and zoom so every card is on screen
- B5. The board has evenly spaced dots in a grid pattern so the user can easily see the effects of moving the board or zooming in or out
  - The dots should adjust as the user zooms
    - If the user zooms out, the dots should become smaller and get closer together to simulate the camera getting further away
    - At certain intervals, half of the dots should fade out while the other dots become larger again. This way there are always dots of a useful size to act as a reference
    - This process should reverse for zooming in, with dots getting bigger to simulate getting closer and more dots getting added at the intervals to fill in the gaps

## Shape Card

- S1. Shape cards can be created, moved around the board, resized, and deleted
- S2. I can switch which shape is being drawn (square, triangle, and circle at a minimum)
- S3. I can choose the colour of the shape card

## Draw Card

- D1. I can use the Draw tool to create a line on the board, which becomes a proper card once I release the mouse button
- D2. Once drawing is complete, the card can moved around the board, resized, and deleted
- D3. I can choose the colour and thickness of the line that gets drawn, before and after drawing
- ~~D4. Maybe. I can use the Erase tool to delete parts of existing lines~~
  - Dropped: deleting a drawing card is good enough

## Collaboration

- C1. I can share the board with friends
- C2. I can see which other users are currently on the board I'm on (indicators in the top corner of the screen)
- C3. When any user moves or edits a card, other users on the board see the changes and are unable to interact with the card until the first user releases it
- C4. The cursors of other users and which cards are locked (and by who they are locked) are visible (with a matching colour)

## Changes During Implementation

- B1/B2: Dragging a card near the edge of the screen pans the board and grows it, which was originally out of scope.
- C1: Users on a board are sent back to the dashboard if the board is deleted or unshared with them while they are on it.
- N3: Red was added to the colour options for cards.
- N3: Named colours are now one palette that looks the same in light and dark mode, and only the "auto" colour follows the colour mode.
- N3/S3/D3: New notes, shapes and drawings use the options last picked for that type, and all three start green.
- S2: The Shape button creates the last-picked shape (a square to start), and right-clicking it picks the next shape and colour ahead of time.
- S1/D2: Shapes and drawings only respond to their visible part (the fill or the line) until they are selected, so they don't block cards underneath.
- N1/S1/D2: The area for resizing a card now reaches a little outside its edge, making resizes easier to start.
- D1: Other users see a line while it is being drawn, not just once it becomes a card.
- D4: The eraser was dropped, as deleting a drawing card is good enough.
- C2: The indicators for other users sit in the top-right corner of the top bar.
- C3: A card held by someone else can still be selected, and trying to change it shakes its name tag to show why nothing happened.
- C3: A "Reconnecting…" notice shows while the connection to the board is lost.
