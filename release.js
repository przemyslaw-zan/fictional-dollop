/**
 * @license Copyright (c) 2022-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import minimist from 'minimist';
import { Listr } from 'listr2';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';

const latestVersion = releaseTools.getLastFromChangelog();
const versionChangelog = releaseTools.getChangesForVersion( latestVersion );
const options = getOptions( process.argv.slice( 2 ) );
const githubToken = await getGitHubToken( options );

const tasks = new Listr( [
	{
		title: 'Verifying the repository.',
		task: async () => {
			const errors = await releaseTools.validateRepositoryToRelease( {
				version: latestVersion,
				changes: versionChangelog,
				branch: 'master'
			} );

			if ( !errors.length ) {
				return;
			}

			return Promise.reject( 'Aborted due to errors.\n' + errors.map( message => `* ${ message }` ).join( '\n' ) );
		},
		skip: () => {
			return options.deployOnly;
		}
	},
	{
		title: 'Updating the `#version` field.',
		task: () => {
			return releaseTools.updateVersions( {
				version: latestVersion
			} );
		},
		skip: () => {
			return options.deployOnly;
		}
	},
	{
		title: 'Commit & tag.',
		task: () => {
			return releaseTools.commitAndTag( {
				version: latestVersion,
				files: [
					'package.json'
				]
			} );
		},
		skip: () => {
			return options.deployOnly;
		}
	},
	{
		title: 'Pushing changes.',
		task: () => {
			return releaseTools.push( {
				releaseBranch: 'master',
				version: latestVersion
			} );
		},
		skip: () => {
			return options.deployOnly;
		}
	},
	{
		title: 'Creating the release page.',
		task: async ( _, task ) => {
			const releaseUrl = await releaseTools.createGithubRelease( {
				token: githubToken,
				version: latestVersion,
				description: versionChangelog
			} );

			task.output = `Release page: ${ releaseUrl }`;
		},
		options: {
			persistentOutput: true
		},
		skip: () => {
			return options.deployOnly;
		}
	}
] );

( async () => {
	try {
		await tasks.run();
	} catch ( err ) {
		console.error( err );
	}
} )();

function getOptions( argv ) {
	const options = minimist( argv, {
		boolean: [
			'deploy-only'
		],
		default: {
			'deploy-only': false
		}
	} );

	options.deployOnly = options[ 'deploy-only' ];

	return options;
}

async function getGitHubToken( options ) {
	if ( options.deployOnly ) {
		return null;
	}

	return releaseTools.provideToken();
}