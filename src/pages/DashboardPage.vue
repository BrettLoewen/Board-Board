<script setup lang="ts">
import { h, onMounted, ref, resolveComponent, watch } from "vue";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";
import router from "@/router";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import type { Column, Row } from "@tanstack/vue-table";

type Board = {
  id: string;
  name: string;
  ownedBy: string;
  createdAt: string;
  updatedAt: string;
};

const UButton = resolveComponent("UButton"); // Used to create and define a UButton in code in the table's header
const UDropdownMenu = resolveComponent("UDropdownMenu"); // Used to create and define a UDropdownMenu in code in the table

const auth = useAuthStore();

// Controls the sorting of table columns.
// Starts as an empty array to make each column start with no sorting applied.
const sorting = ref([]);

// Used to filter out rows based on the stored text.
const globalFilter = ref("");

// The data used by the board table (replace with data from supabase later)
const boards = ref<Board[]>([]);

const selectedBoard = ref<Board>();

// Refs for tracking and displaying data in the create board modal
const createBoardName = ref("");
const boardNameError = ref("");
const createBoardModalOpen = ref(false);

// Refs for tracking and displaying data in the rename board modal
const renameBoardPlaceholder = ref("");
const renameBoardName = ref("");
const renameboardError = ref("");
const renameBoardModalOpen = ref(false);

// Refs for tracking and displaying data in the delete board modal
const deleteBoardModalOpen = ref(false);

// Defines what is included in the navbar's user dropdown
const items = ref<DropdownMenuItem[][]>([
  [
    {
      // Display the user's username
      label: auth.profile?.username,
      type: "label",
    },
  ],
  [
    {
      // Send the user to the settings page
      label: "Settings",
      icon: "i-lucide-cog",
      to: ROUTES.SETTINGS,
    },
    {
      // Send the user to the friends page
      label: "Friends",
      icon: "i-fluent-people-community-16-regular",
      to: ROUTES.FRIENDS,
    },
    {
      // Sign out the user (which will send the user back to the welcome page)
      label: "Logout",
      icon: "i-lucide-log-out",
      class: "dropdown-hover",
      onSelect() {
        console.log("Logout");
        auth.logout();
      },
    },
  ],
]);

// Link the column data to a column in the table and format the data as necessary
// The meta classes ensure the columns are the same width (and that the extra columns for sharing and actions are smaller)
const columns: TableColumn<Board>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => getHeader(column, "Name"),
    meta: {
      class: {
        th: "w-50",
        td: "w-50",
      },
    },
  },
  {
    accessorKey: "ownedBy",
    header: ({ column }) => getHeader(column, "Owned By"),
    meta: {
      class: {
        th: "w-50",
        td: "w-50",
      },
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => getHeader(column, "Created At"),
    cell: ({ row }) => {
      return new Date(row.getValue("createdAt")).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    },
    meta: {
      class: {
        th: "w-50",
        td: "w-50",
      },
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => getHeader(column, "Last Updated At"),
    cell: ({ row }) => {
      return new Date(row.getValue("updatedAt")).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    },
    meta: {
      class: {
        th: "w-50",
        td: "w-50",
      },
    },
  },
  {
    id: "share",
    cell: ({ row: boardRow }) => {
      return h(
        UButton,
        {
          class: "create-board-button",
          icon: "i-fluent-share-16-regular",
          onClick: () => console.log("Share " + boardRow.original.name),
        },
        () => {
          return "Share";
        },
      );
    },
    meta: {
      class: {
        th: "w-30",
        td: "w-30",
      },
    },
  },
  {
    id: "actions",
    cell: ({ row: boardRow }) => {
      // Keeps the button pinned to the right side of its column (and therefore to the right side of the table)
      return h(
        "div",
        { class: "text-right" },
        // Define a dropdown that gets its items from getBoardItems() and is triggered by the contained h(UButton)
        h(
          UDropdownMenu,
          {
            content: {
              align: "end",
            },
            items: getBoardItems(boardRow),
            "aria-label": "Actions dropdown",
          },
          () =>
            h(UButton, {
              icon: "i-lucide-ellipsis-vertical",
              color: "neutral",
              variant: "ghost",
              class: "ml-auto dropdown-hover",
              "aria-label": "Actions dropdown",
            }),
        ),
      );
    },
    meta: {
      class: {
        th: "w-10",
        td: "w-10",
      },
    },
  },
];

// Returns a formated header button containing a label and the current sorting icon for the passed column
function getHeader(column: Column<Board>, label: string) {
  const isSorted = column.getIsSorted();

  return h(UButton, {
    color: "neutral",
    variant: "ghost",
    label,
    icon: isSorted
      ? isSorted === "asc"
        ? "i-lucide-arrow-up-narrow-wide"
        : "i-lucide-arrow-down-wide-narrow"
      : "i-lucide-arrow-up-down",
    class: "-mx-2.5 cursor-pointer",
    // Force the sorting order cycle to be: "none" -> "desc" => "asc" -> "none"
    onClick: () => {
      if (isSorted === "asc") {
        column.clearSorting();
      } else if (isSorted === "desc") {
        column.toggleSorting(false);
      } else {
        column.toggleSorting(true);
      }
    },
  });
}

function getBoardItems(boardRow: Row<Board>) {
  return [
    [
      {
        type: "label",
        label: boardRow.original.name,
      },
    ],
    [
      {
        label: "Rename",
        icon: "i-fluent-edit-16-regular",
        class: "dropdown-hover",
        onSelect() {
          renameBoardModalOpen.value = true;
          renameBoardPlaceholder.value = boardRow.original.name;
          selectedBoard.value = boardRow.original;
        },
      },
      {
        label: "Delete",
        icon: "i-fluent-delete-16-regular",
        class: "dropdown-hover",
        onSelect() {
          deleteBoardModalOpen.value = true;
          selectedBoard.value = boardRow.original;
        },
      },
    ],
  ];
}

// If a new board was submitted for creation, validate the name and then create the board
async function createBoard(close: () => void): Promise<void> {
  // If the board's name is not long enough, say so and stop
  if (!createBoardName.value || createBoardName.value.length < 3) {
    boardNameError.value = "Board name is too short!";
    return;
  }

  // If the board's name is valid, reset the error message
  boardNameError.value = "";

  console.log("Create board " + createBoardName.value);

  // Create the board
  const { error } = await supabase
    .from("boards")
    .insert({ name: createBoardName.value, owner_id: auth.user?.id ?? "" });

  if (error) {
    console.error(error);
    return;
  }

  // Close the modal
  close();

  // Reset the board name ref
  createBoardName.value = "";

  // Update the list of boards to include the newly created board
  getBoards();
}

// If the create board modal was closed using the cancel button, reset the modal refs
async function cancelCreateBoard(close: () => void): Promise<void> {
  boardNameError.value = "";
  createBoardName.value = "";

  // Close the modal
  close();
}

async function getBoards(): Promise<void> {
  // Get the data for all boards owned by this user
  const { data: boardsData, error: boardsError } = await supabase
    .from("boards")
    .select()
    .eq("owner_id", auth.user?.id ?? "");

  // Get the data for all boards that have been shared to this user
  const { data: sharedBoardsData, error: sharedBoardsError } = await supabase
    .from("shared_boards")
    .select()
    .eq("shared_to_id", auth.user?.id ?? "");

  if (boardsError) {
    console.error(boardsError);
    return;
  }
  if (sharedBoardsError) {
    console.error(sharedBoardsError);
    return;
  }

  console.log(boardsData);
  console.log(sharedBoardsData);

  // Clear the list of boards
  boards.value = [];

  if (boardsData) {
    // Loop through each row of the data
    boardsData.forEach((board) => {
      // Get the data from the board and format it as needed
      boards.value.push({
        id: board.id,
        name: board.name ?? "",
        ownedBy: "You",
        createdAt: new Date(board.created_at ?? "")
          .toLocaleString("en-US", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .toString(),
        updatedAt: new Date(board.updated_at ?? 0)
          .toLocaleString("en-US", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .toString(),
      });
    });
  }
}

// If a new name for a board was submitted, validate the name and rename the board
async function renameBoard(close: () => void): Promise<void> {
  if (!selectedBoard.value) {
    return;
  }

  // If the new name is not long enough, say so and stop
  if (!renameBoardName.value || renameBoardName.value.length < 3) {
    renameboardError.value = "Board name is too short!";
    return;
  }

  // If the new name is valid, reset the error message
  renameboardError.value = "";

  // console.log("Rename board " + selectedBoard.value.name + " to " + renameBoardName.value);

  // Update the board's name
  const { error } = await supabase
    .from("boards")
    .update({ name: renameBoardName.value })
    .eq("id", selectedBoard.value.id);

  if (error) {
    console.error(error);
    return;
  }

  // Close the modal
  close();

  // Reset the board name ref
  renameBoardName.value = "";

  // Update the list of boards to include board's new name
  getBoards();

  // Unselect the board
  selectedBoard.value = undefined;
}

// If the rename board modal was closed using the cancel button, reset the modal refs
async function cancelRenameBoard(close: () => void): Promise<void> {
  renameboardError.value = "";
  renameBoardName.value = "";

  // Close the modal
  close();

  // Unselect the board
  selectedBoard.value = undefined;
}

// Delete the currently selected board
async function deleteBoard(close: () => void): Promise<void> {
  if (!selectedBoard.value) {
    return;
  }

  // console.log("Delete board " + selectedBoard.value.name);

  // Delete the board
  const { error } = await supabase.from("boards").delete().eq("id", selectedBoard.value.id);

  if (error) {
    console.error(error);
    return;
  }

  // Close the modal
  close();

  // Update the list of boards to remove the deleted board from the list
  getBoards();

  // Unselect the board
  selectedBoard.value = undefined;
}

// Send the user to the page for this board (open the board)
function onSelectBoard(row: Row<Board>) {
  router.push(ROUTES.BOARD(row.original.id));
}

// If the create board modal was closed using the modal's own close button, reset the modal refs
watch(createBoardModalOpen, (newValue) => {
  if (!newValue) {
    boardNameError.value = "";
    createBoardName.value = "";
  }
});

// If the rename board modal was closed using the modal's own close button, reset the modal refs
watch(renameBoardModalOpen, (newValue) => {
  if (!newValue) {
    renameboardError.value = "";
    renameBoardName.value = "";
  }
});

onMounted(() => {
  getBoards();
});
</script>

<template>
  <UDashboardNavbar class="navbar">
    <template #left>
      <ULink to="/" as="button" class="text-primary font-medium text-2xl">Board Board</ULink>
    </template>

    <template #right>
      <UDropdownMenu :items="items">
        <UButton class="navbar-right-button" size="sm">
          <template #leading>
            <UIcon name="i-fluent-person-circle-12-regular" class="w-6 h-6" />
          </template>
        </UButton>
      </UDropdownMenu>
    </template>
  </UDashboardNavbar>

  <div class="main">
    <div class="table-header">
      <UModal
        title="Create a New Board"
        description="Create a new Board with the following name."
        v-model:open="createBoardModalOpen"
        :close="{ class: 'create-board-modal-close-button' }"
      >
        <UButton
          class="create-board-button"
          leading-icon="i-lucide-circle-plus"
          label="New Board"
        />
        <template #body="{ close }">
          <div class="mb-6 w-full">
            <UInput v-model="createBoardName" placeholder="Board name" />
            <div v-if="boardNameError" class="mt-2 text-sm text-error">
              {{ boardNameError }}
            </div>
          </div>
          <div class="create-board-modal-buttons">
            <UButton class="create-board-button" label="Create Board" @click="createBoard(close)" />
            <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              class="create-board-modal-cancel-button"
              @click="cancelCreateBoard(close)"
            />
          </div>
        </template>
      </UModal>
      <UInput v-model="globalFilter" placeholder="Filter..." />
    </div>
    <UTable
      class="table"
      :data="boards"
      v-model:global-filter="globalFilter"
      v-model:sorting="sorting"
      :columns="columns"
      @select="onSelectBoard"
      :ui="{
        tr: 'cursor-pointer',
        th: 'cursor-default',
      }"
    />
  </div>
  <UModal
    title="Rename Board"
    description="Change this Board's name."
    v-model:open="renameBoardModalOpen"
    :close="{ class: 'create-board-modal-close-button' }"
  >
    <template #body="{ close }">
      <div class="mb-6 w-full">
        <UInput v-model="renameBoardName" :placeholder="renameBoardPlaceholder" />
        <div v-if="renameboardError" class="mt-2 text-sm text-error">
          {{ renameboardError }}
        </div>
      </div>
      <div class="create-board-modal-buttons">
        <UButton class="create-board-button" label="Rename Board" @click="renameBoard(close)" />
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          class="create-board-modal-cancel-button"
          @click="cancelRenameBoard(close)"
        />
      </div>
    </template>
  </UModal>
  <UModal
    title="Delete Board"
    description="This action cannot be reversed. All data within this Board will be deleted, and all users will lose access to it. Are you sure you want to delete this Board?"
    v-model:open="deleteBoardModalOpen"
    :close="{ class: 'create-board-modal-close-button' }"
  >
    <template #body="{ close }">
      <div class="create-board-modal-buttons">
        <UButton color="error" label="Delete" class="delete-button" @click="deleteBoard(close)" />
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          class="create-board-modal-cancel-button"
          @click="close"
        />
      </div>
    </template>
  </UModal>
</template>

<style>
.navbar {
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
  padding-left: 15px;
  padding-right: 15px;
}

.navbar-right-button {
  border-radius: 50%;
}
.navbar-right-button:hover {
  cursor: pointer;
}
.navbar-right-button:active {
  background-color: var(--color-primary-800);
}

.dropdown-hover:hover {
  cursor: pointer;
}

.main {
  width: 100%;
  height: 100%;
  padding: 15px;
}

.create-board-button:active {
  background-color: var(--color-primary-800);
}
.create-board-button:hover {
  cursor: pointer;
}

.create-board-modal-close-button:active {
  background-color: var(--color-neutral-800);
}
.create-board-modal-close-button:hover {
  cursor: pointer;
}

.create-board-modal-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
}

.create-board-modal-cancel-button:active {
  background-color: var(--color-neutral-800);
}
.create-board-modal-cancel-button:hover {
  cursor: pointer;
}

.table-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.table {
  width: 100%;
  border: 1px solid;
  border-radius: 5px;
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
}
</style>
