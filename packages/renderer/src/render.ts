import path from 'path';
import {VideoConfig} from 'remotion';
import {openBrowser, provideScreenshot} from '.';
import {getActualConcurrency} from './get-concurrency';
import {DEFAULT_IMAGE_FORMAT, ImageFormat} from './image-format';
import {Pool} from './pool';

export const renderFrames = async ({
	config,
	parallelism,
	onFrameUpdate,
	compositionId: compositionId,
	outputDir,
	onStart,
	userProps,
	webpackBundle,
	quality,
	imageFormat = DEFAULT_IMAGE_FORMAT,
}: {
	config: VideoConfig;
	parallelism?: number | null;
	onFrameUpdate: (f: number) => void;
	onStart: () => void;
	compositionId: string;
	outputDir: string;
	userProps: unknown;
	webpackBundle: string;
	imageFormat?: ImageFormat;
	quality?: number;
}) => {
	if (quality !== undefined && imageFormat !== 'jpeg') {
		throw new Error(
			"You can only pass the `quality` option if `imageFormat` is 'jpeg'."
		);
	}
	const actualParallelism = getActualConcurrency(parallelism ?? null);

	const browser = await openBrowser();
	const pages = new Array(actualParallelism).fill(true).map(async () => {
		const page = await browser.newPage();
		page.setViewport({
			width: config.width,
			height: config.height,
			deviceScaleFactor: 1,
		});
		page.on('error', console.error);
		page.on('pageerror', console.error);

		const site = `file://${webpackBundle}/index.html?composition=${compositionId}&props=${encodeURIComponent(
			JSON.stringify(userProps)
		)}`;
		await page.goto(site);
		return page;
	});

	const pool = new Pool(await Promise.all(pages));

	const {durationInFrames: frames} = config;
	const filePadLength = String(frames).length;
	let framesRendered = 0;
	onStart();
	await Promise.all(
		new Array(frames)
			.fill(Boolean)
			.map((x, i) => i)
			.map(async (f) => {
				const freePage = await pool.acquire();
				const paddedIndex = String(f).padStart(filePadLength, '0');
				try {
					await provideScreenshot({
						page: freePage,
						imageFormat,
						quality,
						options: {
							frame: f,
							output: path.join(
								outputDir,
								`element-${paddedIndex}.${imageFormat}`
							),
						},
					});
				} catch (err) {
					console.log('Error taking screenshot', err);
				} finally {
					pool.release(freePage);
					framesRendered++;
					onFrameUpdate(framesRendered);
				}
			})
	);

	// Collect assets in all pages and remove duplicates
	const assets = (
		await Promise.all(
			pool.resources.map(async (page) => {
				return await page.evaluate(() => {
					return window.remotion_collectAssets();
				});
			})
		)
	).reduce((acc, cur) => {
		return [
			...acc,
			...cur.filter((asset) => !acc.find((a) => a.id === asset.id)),
		];
	});
	console.log(assets);

	await browser.close();
};
