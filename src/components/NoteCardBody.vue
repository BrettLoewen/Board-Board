<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import type { Card } from "@/stores/board";
import type { Point } from "@/utils/camera";
import { parseNoteContent } from "@/cards/note";
import { cardBackground, cardText } from "@/utils/colors";

// The note to draw, whether its text is being edited, and where the click that started editing was
// (in client pixels), so the text cursor can be put there
const props = defineProps<{ card: Card; editable: boolean; caretPoint: Point | null }>();

// The body never writes to the store or the database itself. BaseCard owns that.
const emit = defineEmits<{
  // The note's content changed
  content: [patch: { text: string }];
  // The text no longer fits, so the note should grow taller by this many world units
  grow: [height: number];
  // The user finished editing (Escape, or focus moved away)
  stopEditing: [];
}>();

const content = computed(() => parseNoteContent(props.card.content));
const textareaElement = useTemplateRef("textarea-element");

// The note's colours (resolved for the current colour mode) and text size
const style = computed(() => ({
  backgroundColor: cardBackground(content.value.color),
  color: cardText(content.value.textColor, content.value.color),
  fontSize: `${content.value.fontSize}px`,
}));

// When editing starts, focus the text and put the cursor where the user clicked (or at the end).
// When it stops, let go of focus.
watch(
  () => props.editable,
  async (editable) => {
    const textarea = textareaElement.value;
    if (!textarea) return;

    if (!editable) {
      textarea.blur();
      return;
    }

    await nextTick();
    textarea.focus();
    const caret = props.caretPoint ? caretOffsetAt(props.caretPoint) : null;
    const offset = caret ?? textarea.value.length;
    textarea.setSelectionRange(offset, offset);
  },
);

// Find which character in the text is under a point on the screen.
// Supported in current browsers. Returns null where it isn't, and the cursor goes to the end instead.
function caretOffsetAt(point: Point): number | null {
  if (!("caretPositionFromPoint" in document)) return null;
  const position = document.caretPositionFromPoint(point.x, point.y);
  return position && position.offsetNode === textareaElement.value ? position.offset : null;
}

// Grow the note if its text has run past the bottom.
// The textarea sits inside the scaled board, so its pixel sizes are already in world units.
async function growToFit(): Promise<void> {
  await nextTick();
  const textarea = textareaElement.value;
  if (textarea && textarea.scrollHeight > textarea.clientHeight) {
    emit("grow", textarea.scrollHeight - textarea.clientHeight);
  }
}

// Send each change to the card, then grow the note if the text no longer fits
function onInput(event: Event): void {
  emit("content", { text: (event.target as HTMLTextAreaElement).value });
  growToFit();
}

// A bigger text size can push the text past the bottom too, so grow the note to fit.
// TODO (basic collaboration): only the user who changed the size should grow the note, not everyone who sees it change.
watch(() => content.value.fontSize, growToFit);

// While the note isn't being edited, pressing on the text must not focus it or start selecting text.
// The press is left to BaseCard, which decides between a click (start editing) and a drag (move the card).
function onMouseDown(event: MouseEvent): void {
  if (!props.editable) event.preventDefault();
}
</script>

<template>
  <div class="note-card" :style="style">
    <textarea
      ref="textarea-element"
      class="note-textarea"
      :class="{ 'note-textarea-editing': editable }"
      :value="content.text"
      :readonly="!editable"
      :tabindex="editable ? 0 : -1"
      placeholder="Type something..."
      @input="onInput"
      @mousedown="onMouseDown"
      @blur="emit('stopEditing')"
      @keydown.escape="emit('stopEditing')"
    ></textarea>
  </div>
</template>

<style>
.note-card {
  display: flex;
  width: 100%;
  height: 100%;
  /* The padding is a frame that can still be grabbed to move the note while its text is being edited */
  padding: 14px;
  border-radius: 4px;
}

.note-textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  line-height: 1.4;
  /* Until editing starts, the text behaves like part of the card (no text cursor, no selection) */
  cursor: inherit;
  user-select: none;
}
.note-textarea::placeholder {
  color: inherit;
  opacity: 0.5;
}
.note-textarea:focus {
  outline: none;
}
.note-textarea-editing {
  cursor: text;
  user-select: text;
}
</style>
