#!/usr/bin/env tsx
/**
 * Script to check agent/app ownership
 * Usage: tsx scripts/check-agent-ownership.ts <agentId> [userId]
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../worker/database/schema';
import { eq } from 'drizzle-orm';

async function checkAgentOwnership(agentId: string, userId?: string) {
	console.log(`\n🔍 Checking ownership for agent: ${agentId}\n`);

	// Note: This script would need to be run in a context where you have access to the D1 database
	// For local development, you can use wrangler d1 execute
	
	console.log('To check ownership, run:');
	console.log(`\nwrangler d1 execute vibesdk-db --local --command="SELECT id, user_id, title, status FROM apps WHERE id = '${agentId}';"`);
	
	if (userId) {
		console.log(`\nwrangler d1 execute vibesdk-db --local --command="SELECT id, email, username FROM users WHERE id = '${userId}';"`);
	}
	
	console.log('\nOr check all apps for a user:');
	if (userId) {
		console.log(`\nwrangler d1 execute vibesdk-db --local --command="SELECT id, title, user_id, status FROM apps WHERE user_id = '${userId}';"`);
	} else {
		console.log('\nwrangler d1 execute vibesdk-db --local --command="SELECT id, title, user_id, status FROM apps LIMIT 10;"');
	}
}

const agentId = process.argv[2];
const userId = process.argv[3];

if (!agentId) {
	console.error('Usage: tsx scripts/check-agent-ownership.ts <agentId> [userId]');
	process.exit(1);
}

checkAgentOwnership(agentId, userId).catch(console.error);
