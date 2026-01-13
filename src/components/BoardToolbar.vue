<script setup lang="ts"></script>

<template>
  <div class="toolbar flex flex-col">
    <UButton class="toolbar-button flex flex-col gap-0">
      <UIcon name="i-ph-note" class="size-14" />
      <p>Note</p>
    </UButton>
    <UButton class="toolbar-button flex flex-col gap-0">
      <UIcon name="i-ix-shapes" class="size-14" />
      <p>Shape</p>
    </UButton>
    <UButton class="toolbar-button">Draw</UButton>
    <UButton class="toolbar-button">Erase</UButton>
  </div>
</template>

<style>
.toolbar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  margin: 15px;
  padding: 15px;
  gap: 15px;
  background-color: var(--ui-bg);
  border-radius: 10px;
  border-width: 1px;
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}

.toolbar-button:active {
  background-color: var(--color-primary-800);
}
.toolbar-button:hover {
  cursor: pointer;
}
</style>
