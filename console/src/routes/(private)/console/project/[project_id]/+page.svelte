<script lang="ts">
	import { page } from '$app/stores';
	import Input from '$lib/components/Input.svelte';

	const { project } = $page.data;
</script>

<div class="w-full p-8">
	<div
		class="w-full bg-dark brightness-125 rounded-xl border-full p-4 flex justify-between items-center"
	>
		<label for="id" class="mr-4">Project ID</label>
		<div class="hover:cursor-text w-80">
			<Input type="text" id="id" disabled cursor="text" copy value={project.id} />
		</div>
	</div>

	<div
		class="w-full bg-dark brightness-125 rounded-xl border-full p-4 mt-12 flex justify-between items-center"
	>
		<label for="api_key" class="mr-4">API KEY</label>
		<div class="hover:cursor-text w-80">
			<Input
				type="password"
				id="api_key"
				disabled
				cursor="text"
				copy
				value={project.keystore.api_key}
			/>
		</div>
	</div>
</div>
