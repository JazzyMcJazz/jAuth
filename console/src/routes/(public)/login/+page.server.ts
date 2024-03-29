import { fail, redirect, type Actions } from '@sveltejs/kit';

import Zod from '$lib/server/utils/zod/Zod';
import type { PageServerLoad } from './$types';
import { AUTH_TARGET } from '$env/static/private';
import UAParser from '$lib/server/utils/parsing/UAParser';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.consoleUser) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, getClientAddress, fetch, cookies }) => {
		const form = await request.formData();
		const formData = Object.fromEntries(form);

		const parsedData = Zod.login.parse(formData);

		if (parsedData.error) {
			return fail(400, parsedData);
		}

		const uaParser = new UAParser(request.headers);
		const { browser, os } = uaParser.getResults();

		const headers = {
			'Content-Type': 'application/json',
			'User-Agent': request.headers.get('user-agent') || '',
			'x-forwarded-for': getClientAddress(),
			'x-forwarded-browser': browser || '',
			'x-forwarded-os': os || ''
		};

		const response = await fetch(AUTH_TARGET + '/account/login', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				email: parsedData.email,
				password: parsedData.password
			})
		});

		if (!response.ok) {
			const data = await response.json();
			return fail(data.code, { error: true, message: data.message });
		}

		const tokens = response.headers.get('Authorization')?.split(', ') || [];

		cookies.set('access_token', tokens[0].split(' ')[1], {
			maxAge: 60 * 15 - 10,
			httpOnly: true,
			secure: true,
			path: '/',
			sameSite: 'strict'
		});

		cookies.set('session_token', tokens[1].split(' ')[1], {
			maxAge: 60 * 60 * 24 * 365 - 10,
			httpOnly: true,
			secure: true,
			path: '/',
			sameSite: 'strict'
		});

		throw redirect(302, '/');
	}
};
