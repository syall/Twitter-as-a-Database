const express = require('express');
const router = express.Router();
const {
	client,
	tweetToRecord,
	toPublicUser,
	recordContains,
	hashtagify,
	URLS,
} = require('../utils/twitter');
const { DEFAULT_DB } = process.env;

router.get('/', async (req, res) => {
	try {
		const tweets = await client.get(URLS.get, { screen_name: DEFAULT_DB });
		const users = tweets.map(tweetToRecord);
		res.json(users.map(toPublicUser));
	} catch (err) {
		res.status(400).json({
			message: 'Unable to get Public Users.'
		});
	}
});

router.get('/search', async (req, res) => {
	try {
		let users = (await client.get(URLS.get, { screen_name: DEFAULT_DB }))
			.map(tweetToRecord);
		for (const [k, v] of Object.entries(req.query))
			users = users.filter(u =>
				u[k].visibility === 'PUBLIC'
					? u[k].value.toString().startsWith(v)
					: false
			);
		res.json(users.map(toPublicUser));
	} catch (err) {
		res.status(400).json({
			message: 'Unable to get Public Users.'
		});
	}
});

router.post('/create', async (req, res) => {
	try {
		const { user, password } = req.body;
		if (!user || !password)
			throw new Error();
		const tweets = await client.get(URLS.get, { screen_name: DEFAULT_DB });
		const [userFound] = tweets
			.map(tweetToRecord)
			.filter(recordContains('user')(user));
		if (userFound)
			throw new Error();
		const { created_at: posted } = await client.post(URLS.create, {
			status:
				`#USERPUBLICSTRG${user} ` +
				`#PASSWORDSECRETSTRG${password} ` +
				`#ACTIVEPUBLICBOOLtrue`
		});
		if (!posted)
			throw new Error();
		res.json({ user, active: true });
	} catch (err) {
		res.status(400).json({
			message: 'Unable to create user.'
		});
	}
});

router.get('/find/:user', async (req, res) => {
	try {
		const { user } = req.params;
		const tweets = await client.get(URLS.get, { screen_name: DEFAULT_DB });
		const [userFound] = tweets
			.map(tweetToRecord)
			.filter(recordContains('user')(user));
		if (!userFound)
			throw new Error();
		res.json(toPublicUser(userFound));
	} catch (err) {
		res.status(400).json({
			message: 'Unable to get user.'
		});
	}
});

router.put('/update/:user', async (req, res) => {
	try {
		const { user } = req.params;
		const tweets = await client.get(URLS.get, { screen_name: DEFAULT_DB });

		const [userFound] = tweets
			.map(tweetToRecord)
			.filter(recordContains('user')(user));
		if (!userFound)
			throw new Error();

		const id = userFound.id.value;
		delete userFound.id;
		for (const [k, v] of Object.entries(req.body)) {
			if (
				!userFound[k] &&
				v.hasOwnProperty('type') &&
				v.hasOwnProperty('visibility') &&
				v.hasOwnProperty('value') &&
				Object.keys(v).length === 3
			) {
				userFound[k] = v;
				continue;
			}
			if (userFound[k].type !== v.type)
				throw new Error();
			if (userFound[k].visibility === 'SECRET')
				throw new Error();
			if (k === 'user')
				throw new Error();
			if (v.value === null) {
				delete userFound[k];
				continue;
			}
			const firstLetter = v.value.toString()[0];
			if (firstLetter >= '0' && firstLetter <= '9' &&
				firstLetter.toUpperCase() === firstLetter)
				throw new Error();
			userFound[k].value = v.value;
		}

		const newTweet = [];
		for (const [k, v] of Object.entries(userFound))
			newTweet.push(hashtagify([k, v]));

		const { created_at: posted } =
			await client.post(URLS.create, {
				status: newTweet.join(' ')
			});
		if (!posted)
			throw new Error();

		const { created_at: deleted } = await client.post(URLS.delete, { id });
		if (!deleted)
			throw new Error();

		res.json([userFound].map(toPublicUser)[0]);
	} catch (err) {
		console.log(err);
		res.status(400).json({
			message: 'Unable to update user.'
		});
	}
});

router.delete('/delete/:user', async (req, res) => {
	try {
		const { user } = req.params;
		const tweets = await client.get(URLS.get, { screen_name: DEFAULT_DB });
		const [userFound] = tweets
			.map(tweetToRecord)
			.filter(recordContains('user')(user));
		if (!userFound)
			throw new Error();
		await client.post(URLS.delete, {
			id: userFound.id.value
		});
		res.json(toPublicUser(userFound));
	} catch (err) {
		res.status(400).json({
			message: 'Unable to delete user.'
		});
	}
});

module.exports = router;
