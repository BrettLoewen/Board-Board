<script setup lang="ts">
import { h, onMounted, ref, resolveComponent, watch } from "vue";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/stores/auth";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import type { Column } from "@tanstack/vue-table";
import { supabase } from "@/lib/supabaseClient";

type Board = {
  name: string;
  ownedBy: string;
  createdAt: string;
  updatedAt: string;
};

const UButton = resolveComponent("UButton"); // Used to create and define a UButton in code in the table's header

const auth = useAuthStore();

// Controls the sorting of table columns.
// Starts as an empty array to make each column start with no sorting applied.
const sorting = ref([]);

// Used to filter out rows based on the stored text.
const globalFilter = ref("");

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
      class: "logout",
      onSelect() {
        console.log("Logout");
        auth.logout();
      },
    },
  ],
]);

// The data used by the board table (replace with data from supabase later)
const boards = ref<Board[]>([]);

// Link the column data to a column in the table and format the data as necessary
const columns: TableColumn<Board>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => getHeader(column, "Name"),
  },
  {
    accessorKey: "ownedBy",
    header: ({ column }) => getHeader(column, "Owned By"),
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
    class: "-mx-2.5",
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

// Refs for tracking and displaying data in the create board modal
const newBoardName = ref("");
const boardNameError = ref("");
const createBoardModalOpen = ref(false);

// If the create board modal was closed using the modal's own close button, reset the modal refs
watch(createBoardModalOpen, (newValue) => {
  if (!newValue) {
    boardNameError.value = "";
    newBoardName.value = "";
  }
});

// If a new board was submitted for creation, validate the name and then create the board
async function createBoard(close: () => void): Promise<void> {
  // If the board's name is not long enough, say so and stop
  if (!newBoardName.value || newBoardName.value.length < 3) {
    boardNameError.value = "Board name is too short!";
    return;
  }

  // If the board's name is valid, reset the error message
  boardNameError.value = "";

  // Close the modal
  close();

  console.log("Create board " + newBoardName.value);

  // Create the board
  const { error } = await supabase
    .from("boards")
    .insert({ name: newBoardName.value, owner_id: auth.user?.id ?? "" });

  if (error) {
    console.error(error);
    return;
  }

  // Reset the board name ref
  newBoardName.value = "";

  // Update the list of boards to include the newly created board
  getBoards();
}

// If the create board modal was closed using the cancel button, reset the modal refs
async function cancelCreateBoard(close: () => void): Promise<void> {
  boardNameError.value = "";
  newBoardName.value = "";

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
      //
      boards.value.push({
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
            <UInput v-model="newBoardName" placeholder="Board name" />
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
    />
  </div>
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

.logout:hover {
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
