// Cloudflare Pages Function — POST /api/subscribe
// Calls GetResponse API to add contact to campaign.
// Optional: also push to Pancake CRM if PANCAKE_API_KEY set.
// Required env vars: GETRESPONSE_API_KEY, GETRESPONSE_CAMPAIGN_ID
// Optional env vars:  PANCAKE_API_KEY, PANCAKE_PAGE_ID

interface Env {
	GETRESPONSE_API_KEY: string;
	GETRESPONSE_CAMPAIGN_ID: string;
	PANCAKE_API_KEY?: string;
	PANCAKE_PAGE_ID?: string;
}

interface SubscribePayload {
	name?: string;
	email?: string;
	phone?: string;
	source?: string;
	tag?: string;
}

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

async function pushGetResponse(env: Env, contact: {
	email: string;
	name: string;
	tag?: string;
}): Promise<boolean> {
	const body: Record<string, unknown> = {
		email: contact.email,
		name: contact.name,
		campaign: { campaignId: env.GETRESPONSE_CAMPAIGN_ID },
		dayOfCycle: 0,
	};
	if (contact.tag) {
		body.tags = [{ name: contact.tag }];
	}
	const res = await fetch('https://api.getresponse.com/v3/contacts', {
		method: 'POST',
		headers: {
			'X-Auth-Token': `api-key ${env.GETRESPONSE_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	return res.ok || res.status === 202;
}

async function pushPancake(env: Env, contact: {
	email: string;
	name: string;
	phone?: string;
	tag?: string;
}): Promise<boolean> {
	if (!env.PANCAKE_API_KEY || !env.PANCAKE_PAGE_ID) return true; // skip if not configured
	try {
		const res = await fetch(
			`https://pages.fm/api/v1/pages/${env.PANCAKE_PAGE_ID}/customers?access_token=${env.PANCAKE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: JSON.stringify({
					name: contact.name,
					emails: [contact.email],
					phone_numbers: contact.phone ? [contact.phone] : [],
					tags: contact.tag ? [contact.tag] : [],
					note: `Lead from website. Tag: ${contact.tag || 'general'}`,
				}),
			}
		);
		return res.ok;
	} catch (err) {
		console.error('Pancake error', err);
		return false; // don't fail the whole request
	}
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
	if (!env.GETRESPONSE_API_KEY || !env.GETRESPONSE_CAMPAIGN_ID) {
		return json({ ok: false, error: 'Server chưa cấu hình GetResponse' }, 500);
	}

	let payload: SubscribePayload;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, 400);
	}

	const email = (payload.email || '').trim().toLowerCase();
	const name = (payload.name || '').trim();
	const phone = (payload.phone || '').trim();
	const tag = (payload.tag || '').trim();

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return json({ ok: false, error: 'Email không hợp lệ' }, 400);
	}
	if (!name) {
		return json({ ok: false, error: 'Vui lòng nhập tên' }, 400);
	}

	const [grOk, pkOk] = await Promise.all([
		pushGetResponse(env, { email, name, tag }),
		pushPancake(env, { email, name, phone, tag }),
	]);

	if (!grOk) {
		return json(
			{ ok: false, error: 'Không thể đăng ký lúc này. Vui lòng thử lại.' },
			502
		);
	}

	return json({ ok: true, pancakeSync: pkOk });
};
