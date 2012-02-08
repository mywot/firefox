
exports.constants = {

	version: 20111200,

	platform: "firefox",
	debug: false,        // TODO: disable debug mode!
	default_component: 0,
	server_api : "api.mywot.com",

	components: [
		{ name: 0 },
		{ name: 1 },
		{ name: 2 },
		{ name: 4 }
	],

	reputationlevels: [
		{ name: "rx", min: -2 },
		{ name: "r0", min: -1 },
		{ name: "r1", min:  0 },
		{ name: "r2", min: 20 },
		{ name: "r3", min: 40 },
		{ name: "r4", min: 60 },
		{ name: "r5", min: 80 }
	],

	confidencelevels: [
		{ name: "cx", min: -2 },
		{ name: "c0", min: -1 },
		{ name: "c1", min:  6 },
		{ name: "c2", min: 12 },
		{ name: "c3", min: 23 },
		{ name: "c4", min: 34 },
		{ name: "c5", min: 45 }
	],

	searchtypes: {
		optimized: 0,
		worst: 1,
		trustworthiness: 2
	},

	warningtypes: { /* bigger value = more severe warning */
		none: 0,
		notification: 1,
		overlay: 2,
		block: 3
	},

	warningreasons: { /* bigger value = more important reason */
		none: 0,
		unknown: 1,
		rating: 2,
		reputation: 3
	},

	urls: {
		base:		"http://www.mywot.com/",
		scorecard:	"http://www.mywot.com/scorecard/",
		settings:	"http://www.mywot.com/settings",
		setcookies:	"http://www.mywot.com/setcookies.php",
		update:		"http://www.mywot.com/update"
	},

	firstrunupdate: 1, /* increase to show a page after an update */

	cachestatus: {
		error:	0,
		ok:		1,
		busy:	2,
		retry:	3,
		link:	4
	}

};