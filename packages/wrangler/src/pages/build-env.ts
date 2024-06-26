import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readConfig } from "../config";
import { FatalError } from "../errors";
import { logger } from "../logger";
import { EXIT_CODE_NO_CONFIG_FOUND } from "./errors";
import type {
	CommonYargsArgv,
	StrictYargsOptionsToInterface,
} from "../yargs-types";

export type PagesBuildEnvArgs = StrictYargsOptionsToInterface<typeof Options>;

export function Options(yargs: CommonYargsArgv) {
	return yargs
		.positional("projectDir", {
			type: "string",
			description: "The location of the Pages project",
		})
		.options({
			outfile: {
				type: "string",
				description: "The location to write the build environment file",
			},
		});
}

export const Handler = async (args: PagesBuildEnvArgs) => {
	if (!args.projectDir) {
		throw new FatalError("No Pages project location specified");
	}
	if (!args.outfile) {
		throw new FatalError("No outfile specified");
	}

	const configPath = path.resolve(args.projectDir, "wrangler.toml");
	// Fail early if the config file doesn't exist
	if (!existsSync(configPath)) {
		throw new FatalError(
			"No Pages config file found",
			EXIT_CODE_NO_CONFIG_FOUND
		);
	}
	logger.log("Reading build configuration from your wrangler.toml file...");

	const config = readConfig(
		configPath,
		{
			...args,
			// eslint-disable-next-line turbo/no-undeclared-env-vars
			env: process.env.PAGES_ENVIRONMENT,
		},
		true
	);

	// Ensure JSON variables are not included
	const textVars = Object.fromEntries(
		Object.entries(config.vars).filter(([_, v]) => typeof v === "string")
	);

	const buildConfiguration = {
		vars: textVars,
		pages_build_output_dir: path.relative(
			args.projectDir,
			config.pages_build_output_dir
		),
	};

	writeFileSync(args.outfile, JSON.stringify(buildConfiguration));
	logger.debug(`Build configuration written to ${args.outfile}`);
	logger.debug(JSON.stringify(buildConfiguration), null, 2);
	const vars = Object.entries(buildConfiguration.vars);
	const message = [
		`Build environment variables: ${vars.length === 0 ? "(none found)" : ""}`,
		...vars.map(([key, value]) => `  - ${key}: ${value}`),
	].join("\n");

	logger.log(message);

	logger.log(
		`pages_build_output_dir: ${buildConfiguration.pages_build_output_dir}`
	);
};
