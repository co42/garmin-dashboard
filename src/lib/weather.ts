export type WeatherIconKey = 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'moon';

/** Map a free-text Garmin weather description to a phosphor icon key. */
export function weatherIcon(desc: string | null | undefined): WeatherIconKey {
	if (!desc) return 'cloud';
	const d = desc.toLowerCase();
	if (d.includes('thunder') || d.includes('storm')) return 'storm';
	if (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) return 'rain';
	if (d.includes('snow') || d.includes('sleet')) return 'snow';
	if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';
	if (d.includes('partly') || d.includes('mostly clear') || d.includes('mostly sunny')) return 'cloud-sun';
	if (d.includes('cloud') || d.includes('overcast')) return 'cloud';
	if (d.includes('clear') || d.includes('sun') || d.includes('fair')) return 'sun';
	return 'cloud';
}
