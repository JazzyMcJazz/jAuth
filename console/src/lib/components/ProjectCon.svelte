<script lang="ts">
	import Plus from 'svelte-icons/fa/FaPlus.svelte';

	export let data: { id: string; name: string } | undefined = undefined;
	export let onClick: (() => void) | undefined = undefined;
</script>

<div class="project-container group relative">
	{#if data}
		<a href="/console/project/{data.id}" class="w-full h-full text-slate-100">
			<div class="relative w-full h-full flex pt-8 pl-8">
				<h3 class="text-lg">{data.name}</h3>
			</div>
		</a>
	{:else}
		<button
			type="button"
			on:click={onClick}
			class="w-full h-full flex flex-col justify-center items-center text-slate-100"
		>
			<div class="new-project">
				<Plus />
			</div>
			<p>New project</p>
		</button>
	{/if}
</div>
