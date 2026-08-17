<script setup>
import { computed, ref } from "vue";

const active = ref("Contents");
const expanded = ref({ Users: true, Inquiries: true });
const nav = [
  { label: "Users", icon: "◉", children: ["Admin", "Designers", "Customers"] },
  { label: "Newsletter", icon: "✉" },
  { label: "Appointments", icon: "◷" },
  { label: "Inquiries", icon: "⌁", children: ["General", "Product Inquiries"] },
  { label: "Products", icon: "□" },
  { label: "Contents", icon: "▣" },
];
const title = computed(() => active.value);

function select(item) {
  active.value = item;
}
function toggle(item) {
  expanded.value[item] = !expanded.value[item];
}
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="select('Contents')"
        ><span class="brand-mark">C</span><span>CARACOLE</span
        ><small>ADMIN</small></a
      >
      <nav aria-label="Admin navigation">
        <div v-for="item in nav" :key="item.label" class="nav-group">
          <button
            class="nav-item"
            :class="{ active: active === item.label }"
            @click="item.children ? toggle(item.label) : select(item.label)"
          >
            <span class="nav-icon">{{ item.icon }}</span
            ><span>{{ item.label }}</span
            ><span
              v-if="item.children"
              class="chevron"
              :class="{ open: expanded[item.label] }"
              >⌄</span
            >
          </button>
          <div v-if="item.children && expanded[item.label]" class="subnav">
            <button
              v-for="child in item.children"
              :key="child"
              :class="{ active: active === child }"
              @click="select(child)"
            >
              {{ child }}
            </button>
          </div>
        </div>
      </nav>
      <button class="logout" @click="select('Logout')">
        <span>↪</span> Logout
      </button>
      <div class="account">
        <div class="avatar">WD</div>
        <div><strong>Webdev Dexterton</strong><span>Superuser</span></div>
      </div>
    </aside>
    <main class="main-content">
      <header>
        <div>
          <p class="eyebrow">CARACOLE PH / ADMINISTRATION</p>
          <h1>{{ title }}</h1>
        </div>
        <div class="header-date">
          {{
            new Date().toLocaleDateString("en-PH", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          }}
        </div>
      </header>
      <section class="placeholder-card">
        <p class="eyebrow">{{ title.toUpperCase() }}</p>
        <h2>Hello World</h2>
        <p>
          This is the {{ title }} workspace. Its management tools will live
          here.
        </p>
      </section>
    </main>
  </div>
</template>
