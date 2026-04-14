/**
 * Sarcastic / funny messages shown after a successful sync.
 * Inspired by the collective suffering of Garmin users everywhere.
 */
const messages = [
	// Training Status absurdity
	"Just ran a marathon? Unproductive.",
	"VO₂ Max: dropping. Pace: faster. Make it make sense.",
	"Training Status: Peaking. Enjoy it — it'll say Detraining tomorrow.",
	"PR'd your 10K? Garmin says: Maintaining.",
	"Ran 80km this week. Training Status: Unproductive.",
	"Every easy run is Unproductive. Every hard run is Overreaching. Cool.",
	"Training Load: optimal. Training Status: unproductive. Pick one.",
	"Your fitness is declining. Maybe try running? — Your watch, after a 30K.",

	// Body Battery / Sleep / Recovery
	"Body Battery: 5. Suggested workout: Threshold intervals.",
	"Sleep score: 12. Garmin Coach: Time for 10×800m!",
	"Recovery time: 96 hours. You walked to the fridge.",
	"Slept 9 hours. Sleep score: 34. Thanks, wrist-based lie detector.",
	"Body Battery at 100%? Firmware bug, probably.",
	"Recovery time: 3.5 days. It was an easy jog.",
	"Rest day. Body Battery still at 22. What are you even charging?",
	"Sleep data says you were awake for 3 hours. You have no memory of this.",
	"One beer = Body Battery nosedive. Garmin is not fun at parties.",

	// Metrics nonsense
	"New Lactate Threshold detected! You were walking to the coffee machine.",
	"Your watch detected a new VO₂ Max! …it went down.",
	"Stress level: 98. Activity: lying on the couch.",
	"Training Readiness: 1. Race day: today.",
	"HRV: balanced. Body Battery: 5. Pick a lane, Garmin.",
	"VO₂ Max went up by 1. Time to update the bio on all socials.",
	"Steps today: 42,000. Garmin: You haven't moved in a while.",

	// Garmin Coach / Suggestions
	"Garmin Coach suggested Base Run. You have a 100K in 3 days.",
	"Daily suggestion: Rest. Ignored it. Got Unproductive. Classic.",
	"Garmin Coach believes in you. Your VO₂ Max does not.",
	"Suggested workout: Easy 45min. Did intervals. Training Status: shocked Pikachu.",
	"Garmin says today is a rest day. Garmin doesn't pay your race entry fees.",
	"Garmin Coach: Trust the process. The process: Unproductive for 6 weeks.",

	// Race Predictor
	"Race Predictor: 3:15 marathon. Actual: 4:02. The predictor has been sacked.",
	"Race Predictor says 2:58. Race Predictor has never met your IT band.",
	"You ran faster than your Race Predictor. Garmin owes you an apology.",
	"VO₂ Max: 52. Race Predictor: 2:45 marathon. Sir, I cannot.",

	// Passive-aggressive watch
	"Move! — Your Garmin, 5 minutes after a half marathon.",
	"Your Garmin doesn't judge you. It just… presents data. Passive-aggressively.",
	"Getting cyber-bullied by a watch was not on my bingo card.",
	"The watch costs €500. The therapy from its feedback: priceless.",
	"Garmin notification: It seems like you're not wearing me. Needed a break from the roasting.",
	"Syncing data… Garmin is preparing new ways to disappoint you.",

	// Performance Condition / Form
	"Just set a new PR. Garmin: Performance Condition −5. Thanks for the support.",
	"Garmin: Your running form has degraded. It's kilometer 35, relax.",
	"Ran in the rain. Garmin logged it as a swim.",
	"Took the stairs. Garmin: Intensity minutes earned! Peak fitness achieved.",

	// Contradictions
	"Morning Report: You slept poorly. Training Readiness: low. Have a great run!",
	"Training Status: Overreaching. You took a week off and ran once.",
	"Garmin: Your training is balanced! Also: Your fitness is decreasing!",
	"Finished an ultra. Garmin: Low Training Load this week.",
	"New course record! Recovery time: 17 days.",

	// Apple Watch shade
	"Apple Watch: Great job closing your rings! Garmin: Unproductive. Sleep: terrible.",
];

export function randomSyncMessage(): string {
	return messages[Math.floor(Math.random() * messages.length)];
}
