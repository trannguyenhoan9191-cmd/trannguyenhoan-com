// Cloudflare Pages Function — POST /api/subscribe
// Calls GetResponse API to add contact to campaign.
// Requires env vars: GETRESPONSE_API_KEY, GETRESPONSE_CAMPAIGN_ID

interface Env {
	GETRESPONSE_API_KEY: string;
	GETRESPONSE_CAMPAIGN_ID: string;
}

interface SubscribePayload {
	name?: string;
	email?: string;
}

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

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

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return json({ ok: false, error: 'Email không hợp lệ' }, 400);
	}
	if (!name) {
		return json({ ok: false, error: 'Vui lòng nhập tên' }, 400);
	}

	try {
		const grRes = await fetch('https://api.getresponse.com/v3/contacts', {
			method: 'POST',
			headers: {
				'X-Auth-Token': `api-key ${env.GETRESPONSE_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email,
				name,
				campaign: { campaignId: env.GETRESPONSE_CAMPAIGN_ID },
				dayOfCycle: 0,
			}),
		});

		if (grRes.ok || grRes.status === 202) {
			return json({ ok: true });
		}

		const errBody = await grRes.text();
		console.error('GetResponse error', grRes.status, errBody);
		return json(
			{ ok: false, error: 'Không thể đăng ký lúc này. Vui lòng thử lại.' },
			502
		);
	} catch (err) {
		console.error('Fetch error', err);
		return json({ ok: false, error: 'Lỗi kết nối server' }, 502);
	}
};
