<script lang="ts">
  import { toasts$, type ToastItem } from './toast-store';
  export let fontColor: string = '#fff';
  export let backgroundColor: string = 'rgba(0,0,0,0.8)';
  let toasts: ToastItem[] = [];
  $: $toasts$; // subscribe
</script>

<div class="fixed inset-0 pointer-events-none z-[70]">
  <div class="absolute bottom-4 right-4 flex flex-col gap-2 items-end">
    {#each $toasts$ as toast (toast.id)}
      <div
        class="px-3 py-2 rounded shadow-md text-sm"
        class:bg-green-700={toast.type === 'success'}
        class:bg-blue-700={toast.type === 'info'}
        class:bg-red-700={toast.type === 'error'}
        style:color={fontColor}
      >
        {toast.message}
      </div>
    {/each}
  </div>
</div>
