//
//VIDEO CONTROLS
const video = document.getElementById('livephoto');

video.addEventListener('ended', () => video.pause());

// Replay on hover
video.addEventListener('mouseenter', () => {
	video.currentTime = 0;
	video.play();
});

// Replay on tap (for touch devices)
video.addEventListener('click', () => {
	if (video.paused) {
		video.currentTime = 0;
		video.play();
	} else {
		video.pause();
	}
});
//END VIDEO
//