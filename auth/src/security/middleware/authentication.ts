import { NextFunction, Request, Response } from 'express';
import { AccountJWT, UserJWT } from '../jwt/JWT.js';
import db from '../../database/DatabaseGateway.js';

export const authenticateAccount = async (req: Request, res: Response, next: NextFunction) => {
	let accessToken = req.cookies.account_access_token;
	let sessionToken = req.cookies.account_session_token;

	if (!accessToken) accessToken = req.body.accessToken;
	if (!sessionToken) sessionToken = req.body.sessionToken;

	// Verify access token
	const verifiedAccess = accessToken ? await AccountJWT.verifyAccessToken(accessToken) : null;
	if (verifiedAccess && verifiedAccess.account.id) {
		req.auth = {
			accessToken,
			sessionToken,
			user: {
				id: verifiedAccess.account.id,
				name: verifiedAccess.account.name as string,
				email: verifiedAccess.account.email as string
			}
		};
		next();
		return;
	}

	// Verify session token if access was not verified
	const verifiedSession = sessionToken
		? await AccountJWT.validateAndRenewSession(sessionToken)
		: null;
	
	if (!verifiedSession || !verifiedSession.token || !verifiedSession.account.id) {
		res.status(401).send({ code: 401, message: 'Unauthorized' });
		return;
	}

	accessToken = await AccountJWT.signAccessToken(
		verifiedSession.account.id,
		verifiedSession.session_id
	);

	req.auth = {
		accessToken,
		sessionToken: verifiedSession.token,
		didTokensRefresh: true,
		user: {
			id: verifiedSession.account.id,
			name: verifiedSession.account.name as string,
			email: verifiedSession.account.email as string
		}
	};

	res.cookie('account_access_token', accessToken, {
		maxAge: 1000 * 60 * 15 - 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	res.cookie('account_session_token', verifiedSession.token, {
		maxAge: 1000 * 60 * 60 * 24 * 365 - 1000 * 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	next();
};

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
	let accessToken = req.cookies.access_token;
	let sessionToken = req.cookies.session_token;

	if (!accessToken) accessToken = req.body.accessToken;
	if (!sessionToken) sessionToken = req.body.sessiontoken;

	// Verify access token
	const verifiedAccess = accessToken ? await UserJWT.verifyAccessToken(accessToken) : null;
	if (verifiedAccess && verifiedAccess.account.id) {
		req.auth = {
			accessToken,
			sessionToken,
			user: {
				id: verifiedAccess.account.id,
				name: verifiedAccess.account.name as string,
				email: verifiedAccess.account.email as string
			}
		};
		next();
		return;
	}

	// Verify session token if access was not verified
	const verifiedSession = sessionToken ? await UserJWT.validateAndRenewSession(sessionToken) : null;
	if (
		!verifiedSession ||
		!verifiedSession.token ||
		!verifiedSession.account.id ||
		!verifiedSession.projct_id
	) {
		res.status(401).send({ code: 401, message: 'Unauthorized' });
		return;
	}

	accessToken = await UserJWT.signAccessToken(
		verifiedSession.account.id,
		verifiedSession.session_id,
		verifiedSession.projct_id
	);

	req.auth = {
		accessToken,
		sessionToken: verifiedSession.token,
		didTokensRefresh: true,
		user: {
			id: verifiedSession.account.id,
			name: verifiedSession.account.name as string,
			email: verifiedSession.account.email as string
		}
	};

	res.cookie('access_token', accessToken, {
		maxAge: 1000 * 60 * 15 - 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	res.cookie('session_token', verifiedSession.token, {
		maxAge: 1000 * 60 * 60 * 24 * 365 - 1000 * 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	next();
};

export async function loginAccount(req: Request, res: Response) {
	const account_id = req.body.account.id;

	const session = await AccountJWT.signNewSessionToken(account_id);
	
	if (!session) {
		res.status(500).send({ code: 500, message: 'Internal Error' });
		return;
	}

	const accessToken = await AccountJWT.signAccessToken(account_id, session?.session_id);
	
	res.cookie('account_access_token', accessToken, {
		maxAge: 1000 * 60 * 15 - 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	res.cookie('account_session_token', session.token, {
		maxAge: 1000 * 60 * 60 * 24 * 365 - 1000 * 10, // 1 year minus 10 seconds
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	// Response
	res.send({
		accessToken: accessToken,
		sessionToken: session.token
	});

	saveUserAgent(session.session_id, req);
}

export async function loginUser(req: Request, res: Response) {
	const user_id = req.body.user.id;

	const session = await UserJWT.signNewSessionToken(user_id, req.project.id);

	if (!session) {
		res.status(500).send({ code: 500, message: 'Internal Error' });
		return;
	}

	const accessToken = await UserJWT.signAccessToken(user_id, session?.session_id, req.project.id);

	res.cookie('access_token', accessToken, {
		maxAge: 1000 * 60 * 15 - 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	res.cookie('session_token', session.token, {
		maxAge: 1000 * 60 * 60 * 24 * 365 - 1000 * 10,
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax'
	});

	// Response
	res.send({
		accessToken: accessToken,
		sessionToken: session.token
	});
	
	saveUserAgent(session.session_id, req, 'user');
}

export const verifyProject = async (req: Request, res: Response, next: NextFunction) => {
	const { API_KEY } = req.query;
	if (!API_KEY) {
		res.status(401).send({ code: 401, message: 'API key is missing' });
		return;
	}

	const project = await db.project.findByAPIKey(API_KEY as string);
	if (!project) {
		res.status(401).send({ code: 401, message: 'Invalid API key' });
		return;
	}

	req.project = project;
	next();
};

function saveUserAgent(session_id: bigint, req: Request, type: 'account' | 'user' = 'account') { // Save client information
	try {
		let ip = (req.headers['x-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string | undefined;
		let os = req.headers['x-forwarded-os'] as string; 
		let browser = req.headers['x-forwarded-browser'] as string;
		
		if (!os || !browser) {
			const ua = new UAParser(req);
			const results = ua.getResults();
			console.log(req.socket.remoteAddress);
			
			
			if (!os) os = results.os as string;
			if (!browser) browser = results.browser as string;
		}

		const data = {ip, os, browser, location: undefined};
		
		if (type === 'account') db.accountSession.updateUserAgent(session_id, data);
		else db.userSession.updateUserAgent(session_id, data);
	} catch(e) {
		// console.log(e);
		
	}
}


// UA Parser - TODO: Move to separate file
import { UAParser as UAParserType } from 'ua-parser-js';
type CustomResult = { browser?: string, os?: string }
class UAParser extends UAParserType {
    private headers;

    constructor(req: Request) {
        super(req.headers['user-agent'] || '');
        this.headers = req.headers;
    }
    
    getResults(): CustomResult {
        const results = this.getResult();
        const browser = this.headers['sec-ch-ua'] as string;
        const platform = this.headers['sec-ch-ua-platform'] as string;
		
        if (browser) {
            results.browser.name = browser.split(';')[0].replace(/"/g, '');
        }

        if (platform) {
            results.os.name = platform.replace(/"/g, '');
        }
		
        return {
            browser: results.browser.name || results.ua,
            os: results.os.name
        };
    }
}
