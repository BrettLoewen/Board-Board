<script setup lang="ts">
import { h, ref, resolveComponent } from "vue";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/stores/auth";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";

type Board = {
  name: string;
  openedAt: string;
  ownedBy: string;
};

// enum Sorting {
//   None = 0,
//   Desc = 1,
//   Acs = 2,
// }

// const UButton = resolveComponent("UButton");

const auth = useAuthStore();

const globalFilter = ref("");
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

const columns: TableColumn<Board>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "ownedBy",
    header: "Owned By",
    // header: ({ column }) => {
    //   const isSorted = column.getIsSorted();

    //   return h(UButton, {
    //     color: "neutral",
    //     variant: "ghost",
    //     label: "Owned By",
    //     icon: isSorted
    //       ? isSorted === "asc"
    //         ? "i-lucide-arrow-up-narrow-wide"
    //         : "i-lucide-arrow-down-wide-narrow"
    //       : "i-lucide-arrow-up-down",
    //     class: "-mx-2.5",
    //     onClick: () => column.toggleSorting(),
    //   });
    // },
  },
  {
    accessorKey: "openedAt",
    header: "Last Opened",
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

const sorting = ref([
  {
    id: "name",
    desc: false,
  },
  {
    id: "ownedBy",
    desc: false,
  },
  {
    id: "openedAt",
    desc: false,
  },
]);

// function nextSortingValue(sortValue: Sorting): Sorting {
//   const maxValue = Object.values(Sorting).length / 2 - 1;
//   return sortValue >= maxValue ? 0 : sortValue + 1;
// }

function createBoard(): void {
  console.log("Create board");
}
</script>

<template>
  <UDashboardNavbar class="navbar">
    <template #left>
      <ULink to="/" as="button" class="text-primary font-medium">Board Board</ULink>
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
