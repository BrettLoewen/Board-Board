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
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type Friend = {
  id: string;
  name: string;
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

// Refs for tracking and displaying data in the share board modal
const shareBoardModalOpen = ref(false);
const friends = ref<Friend[]>([]);
const friendsNotShared = ref<Friend[]>([]);
const friendsShared = ref<Friend[]>([]);

// Refs for tracking and displaying data in the leave board modal
const leaveBoardModalOpen = ref(false);

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
      // If this user does not own this board (it was shared to them), display a button to stop receiving the shared board
      if (boardRow.original.ownerId !== auth?.user?.id) {
        return h(
          UButton,
          {
            class: "share-board-modal-error-button",
            variant: "subtle",
            color: "error",
            icon: "i-carbon-close-outline",
            onClick: () => {
              leaveBoardModalOpen.value = true;
              selectedBoard.value = boardRow.original;
            },
          },
          () => "Leave Board",
        );
      }

      // Otherwise, the user does own the board, so display a button to share it to others
      return h(
        UButton,
        {
          class: "create-board-button",
          icon: "i-fluent-share-16-regular",
          onClick: () => {
            getFriendsSharedToBoard(boardRow.original.id);
            shareBoardModalOpen.value = true;
            selectedBoard.value = boardRow.original;
          },
        },
        () => "Share",
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
      // If this user does not own this board (it was shared to them), do not display the action menu
      if (boardRow.original.ownerId !== auth?.user?.id) {
        return h("div");
      }

      // Otherwise, the user does own the board, so display the action dropdown button
      return h(
        "div",
        { class: "text-right" },
        h(
          UDropdownMenu,
          {
            content: { align: "end" },
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

  // Get the data for all boards that have been shared to this user.
  // Get the shared_boards row that shares the board to the user.
  // Get the boards row for the shared board.
  // Get the user_profiles row of the board's owner (so their name can be displayed as the owner).
  const { data: sharedBoardsData, error: sharedBoardsError } = await supabase
    .from("shared_boards")
    .select("*, board:boards(*, owner:user_profiles!boards_owner_id_fkey(*))")
    .eq("shared_to_id", auth.user?.id ?? "");

  if (boardsError) {
    console.error(boardsError);
    return;
  }
  if (sharedBoardsError) {
    console.error(sharedBoardsError);
    return;
  }

  // console.log(boardsData);
  // console.log(sharedBoardsData);

  // Clear the list of boards
  boards.value = [];

  if (boardsData) {
    // Loop through each row of the data (board that the user created)
    boardsData.forEach((board) => {
      // Get the data from the board and format it as needed
      boards.value.push({
        id: board.id,
        name: board.name ?? "",
        ownedBy: "You",
        ownerId: board.owner_id,
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

  if (sharedBoardsData) {
    // Loop through each row of the data (board that was shared to the user)
    sharedBoardsData.forEach((sharedBoard) => {
      // Get the data from the board and format it as needed
      boards.value.push({
        id: sharedBoard.board_id,
        name: sharedBoard.board.name ?? "",
        ownedBy: sharedBoard.board.owner.username ?? "",
        ownerId: sharedBoard.board.owner_id,
        createdAt: new Date(sharedBoard.board.created_at ?? "")
          .toLocaleString("en-US", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .toString(),
        updatedAt: new Date(sharedBoard.board.updated_at ?? 0)
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

async function getFriends(): Promise<void> {
  // Get the friendship relationships that this user has with other users.
  // Will be converted to user_profile rows later.
  const { data, error } = await supabase
    .from("friends")
    .select()
    .or(`user_id_1.eq.${auth.profile?.id},user_id_2.eq.${auth.profile?.id}`);

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    // Clear the stored data so just the up-to-date info is used/displayed
    friends.value = [];

    // Loop through each row of the data
    data.forEach(async (friend) => {
      // Get the user_profile of the other user
      // If the this user's id matches user 1 in the friendship, then get user 2's profile data
      if (friend.user_id_1 === auth.profile?.id) {
        // Get the other user's profile data
        const { data, error } = await supabase
          .from("user_profiles")
          .select()
          .eq("id", friend.user_id_2)
          .limit(1);

        if (error) {
          console.error(error);
          return;
        }

        if (data) {
          // Store the data from the friend that is needed by the UI
          friends.value.push({
            id: data[0]?.id ?? "",
            name: data[0]?.username ?? "",
          });
        }
      }
      // If the this user's id matches user 2 in the friendship, then get user 1's profile data
      else {
        // Get the other user's profile data
        const { data, error } = await supabase
          .from("user_profiles")
          .select()
          .eq("id", friend.user_id_1)
          .limit(1);

        if (error) {
          console.error(error);
          return;
        }

        if (data) {
          // Store the data from the friend that is needed by the UI
          friends.value.push({
            id: data[0]?.id ?? "",
            name: data[0]?.username ?? "",
          });
        }
      }
    });
  }
}

// Get the friends this board has been shared to.
// Also get the friends this board has not been shared to yet.
async function getFriendsSharedToBoard(boardId: string): Promise<void> {
  // Get all the users that the given board was shared to
  const { data, error } = await supabase
    .from("shared_boards")
    .select("*, friend:user_profiles(*)")
    .eq("board_id", boardId);

  if (error) {
    console.error(error);
    return;
  }

  // Store the friends that the given board has been shared to
  if (data) {
    // Clear any old data
    friendsShared.value = [];

    // Loop through each row of the data
    data.forEach((sharedBoard) => {
      // Add each friend that this board was shared with to the array
      friendsShared.value.push({
        id: sharedBoard.friend.id ?? "",
        name: sharedBoard.friend.username ?? "",
      });
    });
  }

  // Store the friends that the given board has not been shared to
  if (friendsShared.value) {
    // Filter out friends that the board has been shared to
    friendsNotShared.value = friends.value.filter((friend) => {
      let friendHasBeenSharedTo = false;

      // Loop through every friend that the board has been shared to
      friendsShared.value.forEach((friendShared) => {
        // If the friends match (if the board has been shared to this friend), record that
        if (friendShared.id === friend.id && friendShared.name === friend.name) {
          friendHasBeenSharedTo = true;
        }
      });

      // If this friend has been shared to, filter it out (return false for this friend, otherwise return true)
      return !friendHasBeenSharedTo;
    });
  }
}

// Share the currently selected board to the given friend
async function shareBoard(friendId: string): Promise<void> {
  if (!selectedBoard.value) {
    return;
  }

  // console.log("Share board " + selectedBoard.value.name + " to " + friendId);

  // Share the currently selected board to the given user
  const { error } = await supabase
    .from("shared_boards")
    .insert({ board_id: selectedBoard.value.id, shared_to_id: friendId });

  if (error) {
    console.error(error);
    return;
  }

  // Refresh the data used by the share board modal
  await getFriendsSharedToBoard(selectedBoard.value.id);
}

// Stop sharing the currently selected board to the given friend
async function unshareBoard(friendId: string): Promise<void> {
  if (!selectedBoard.value) {
    return;
  }

  // console.log("Unshare board " + selectedBoard.value.name + " to " + friendId);

  // Delete the shared_boards row, thereby unsharing the board
  const { error } = await supabase
    .from("shared_boards")
    .delete()
    .eq("board_id", selectedBoard.value.id)
    .eq("shared_to_id", friendId);

  if (error) {
    console.error(error);
    return;
  }

  // Refresh the data used by the share board modal
  await getFriendsSharedToBoard(selectedBoard.value.id);
}

// Stop sharing the currently selected board to the given friend
async function leaveBoard(close: () => void): Promise<void> {
  if (!selectedBoard.value) {
    return;
  }

  // console.log("Leave board " + selectedBoard.value.name);

  // Delete the shared_boards row, thereby leaving the board (unsharing the board with yourself)
  const { error } = await supabase
    .from("shared_boards")
    .delete()
    .eq("board_id", selectedBoard.value.id)
    .eq("shared_to_id", auth?.user?.id ?? "");

  if (error) {
    console.error(error);
    return;
  }

  // Close the modal
  close();

  // Update the list of boards to remove the unshared board from the list
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
  getFriends();
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
  <UModal
    title="Leave Board"
    description="You will lose access to this Board. All your data / work in the Board will remain. Are you sure you want to leave this Board?"
    v-model:open="leaveBoardModalOpen"
    :close="{ class: 'create-board-modal-close-button' }"
  >
    <template #body="{ close }">
      <div class="create-board-modal-buttons">
        <UButton
          color="error"
          label="Leave Board"
          class="delete-button"
          @click="leaveBoard(close)"
        />
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
  <UModal
    title="Share Board"
    description="Share this Board to your friends to collaborate."
    v-model:open="shareBoardModalOpen"
    :close="{ class: 'create-board-modal-close-button' }"
  >
    <template #body>
      <p
        v-if="(!friends || friends.length === 0) && (!friendsShared || friendsShared.length === 0)"
        class="mb-6 text-center text-error"
      >
        Without friends, you cannot share Boards to anyone.
      </p>
      <div class="flex flex-row w-full justify-between">
        <div v-if="friendsNotShared && friendsNotShared.length > 0" class="share-list">
          <div
            v-for="friend in friendsNotShared"
            :key="friend.id"
            class="friend-div rounded-md border-0 ring ring-inset ring-accented"
          >
            <p class="content-center">{{ friend.name }}</p>
            <UButton
              class="create-board-button"
              variant="subtle"
              icon="i-fluent-share-16-regular"
              label="Share"
              @click="shareBoard(friend.id)"
            />
          </div>
        </div>
        <div v-else class="share-list">
          <p class="text-sm text-center text-muted">No friends to share with</p>
        </div>
        <div v-if="friendsShared && friendsShared.length > 0" class="share-list">
          <div
            v-for="friendShare in friendsShared"
            :key="friendShare.id"
            class="friend-div rounded-md border-0 ring ring-inset ring-accented"
          >
            <p class="content-center">{{ friendShare.name }}</p>
            <UButton
              class="share-board-modal-error-button"
              variant="subtle"
              icon="i-carbon-close-outline"
              color="error"
              label="Unshare"
              @click="unshareBoard(friendShare.id)"
            />
          </div>
        </div>
        <div v-else class="share-list">
          <p class="text-sm text-center text-muted">No friends have been shared to</p>
        </div>
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

.share-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 45%;
}

.friend-div {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 10px;
}

.share-board-modal-error-button:active {
  background-color: var(--color-error-800);
}
.share-board-modal-error-button:hover {
  cursor: pointer;
}
</style>
