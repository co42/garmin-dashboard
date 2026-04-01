<script lang="ts">
	import { tick } from 'svelte';
	import type { Course } from '$lib/types.js';
	import CourseRow from './CourseRow.svelte';
	import CourseDetails from './CourseDetails.svelte';

	interface Props {
		courses: Course[];
	}

	let { courses }: Props = $props();

	let expandedId = $state<number | null>(null);

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	export async function navigateTo(courseId: number) {
		expandedId = courseId;
		await tick();
		const el = document.getElementById(`course-${courseId}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<div class="space-y-2">
	{#each courses as course (course.id)}
		<div id="course-{course.id}" class="rounded-lg bg-card">
			<CourseRow
				{course}
				expanded={expandedId === course.id}
				ontoggle={() => toggleExpand(course.id)}
			/>
			{#if expandedId === course.id}
				<CourseDetails {course} />
			{/if}
		</div>
	{/each}

	{#if courses.length === 0}
		<div class="rounded-lg bg-card px-4 py-6 text-center text-xs text-text-dim">
			No courses saved
		</div>
	{/if}
</div>
