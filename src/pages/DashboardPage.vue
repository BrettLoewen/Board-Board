<script setup lang="ts">
import { h, ref, resolveComponent } from "vue";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/stores/auth";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import type { Column } from "@tanstack/vue-table";

type Board = {
  name: string;
  openedAt: string;
  ownedBy: string;
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
const data = ref([
  {
    name: "Board 1",
    ownedBy: "Billy",
    openedAt: "2025-10-11T15:30:00",
  },
  {
    name: "Test Board",
    ownedBy: "Testy",
    openedAt: "2025-10-21T15:30:00",
  },
  {
    name: "Alpha",
    ownedBy: "Testy",
    openedAt: "2025-10-31T15:30:00",
  },
]);

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
    accessorKey: "openedAt",
    header: ({ column }) => getHeader(column, "Opened At"),
    cell: ({ row }) => {
      return new Date(row.getValue("openedAt")).toLocaleString("en-US", {
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

function createBoard(): void {
  console.log("Create board");
}
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
      <UButton class="create-button" leading-icon="i-lucide-circle-plus" @click="createBoard"
        >New Board</UButton
      >
      <UInput v-model="globalFilter" placeholder="Filter..." />
    </div>
    <UTable
      class="table"
      :data="data"
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

.create-button:active {
  background-color: var(--color-primary-800);
}
.create-button:hover {
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
