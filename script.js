// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    const thumbnails = document.querySelectorAll('.thumbnail');
    const storyViewer = document.querySelector('.story-viewer');
    const storiesContainer = document.querySelector('.story-viewer');
    let stories = document.querySelectorAll('.story'); // Changed from const to let
    const navLeft = document.querySelectorAll('.nav-left');
    const navRight = document.querySelectorAll('.nav-right');
    const closeButtons = document.querySelectorAll('.close-btn');
    const ctaButtons = document.querySelectorAll('.cta-btn');
    const pauseResumeButtons = document.querySelectorAll('.pause-resume-btn');
    let currentStory = 0;
    let progressInterval;
    let isPaused = false;
    let progressBarWidth = 0;

    // Configuration parameters
    const config = {
        firstAd: 1,      // Position of the first ad (after X content stories)
        otherAd: 2,      // Position of subsequent ads (every X content stories after the first ad)
        maxAd: 3,        // Maximum number of ads
        preload: 1       // Preload ad request X number of stories before the ad
    };

    let adCount = 0;
    let nextAdIndex = config.firstAd;
    let adRequested = false;

    // Variables for drag functionality
    let isDragging = false;
    let startX, scrollLeft;

    // Populate thumbnails
    function populateStoryBlocks() {
        const storyBlocks = document.querySelectorAll('.story-thumbnails .thumbnails-container');
        storyBlocks.forEach(block => {
            block.innerHTML = '';
        });

        stories.forEach((story, index) => {
            const categories = story.dataset.category.split(',');
            const thumbnailSrc = story.dataset.thumbnail || story.querySelector('.media-container img, .media-container video').src;
            categories.forEach(category => {
                const container = document.querySelector(`.story-thumbnails[data-category="${category}"] .thumbnails-container`);
                if (container) {
                    container.innerHTML += `
                        <div class="thumbnail" data-story="${index}">
                            <img src="${thumbnailSrc}" alt="Story ${index + 1}">
                        </div>
                    `;
                }
            });
        });

        document.querySelectorAll('.thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', () => {
                const storyIndex = parseInt(thumbnail.dataset.story);
                showStory(storyIndex);
            });
        });
    }

    populateStoryBlocks();

    navLeft.forEach(nav => {
        nav.addEventListener('click', (event) => {
            if (event.target === nav) {
                if (currentStory > 0) {
                    currentStory--;
                    showStory(currentStory);
                } else {
                    restartStory();
                }
            }
        });
    });

    navRight.forEach(nav => {
        nav.addEventListener('click', (event) => {
            if (event.target === nav) {
                if (currentStory < stories.length - 1) {
                    currentStory++;
                    showStory(currentStory);
                } else {
                    hideViewer();
                }
            }
        });
    });

    storyViewer.addEventListener('click', (event) => {
        if (event.target === storyViewer) {
            hideViewer();
        }
    });

    closeButtons.forEach(button => {
        button.addEventListener('click', hideViewer);
    });

    ctaButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const story = event.target.closest('.story');
            const ctaUrl = story.dataset.ctaUrl;
            if (ctaUrl) {
                window.open(ctaUrl, '_blank');
            }
        });
    });

    pauseResumeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isPaused) {
                resumeProgress();
                button.textContent = 'Pause';
            } else {
                pauseProgress();
                button.textContent = 'Resume';
            }
        });
    });

    function showStory(index) {
        clearInterval(progressInterval);
        currentStory = index;
        isPaused = false;
        progressBarWidth = 0;
        pauseResumeButtons.forEach(button => button.textContent = 'Pause');

        // Check if an ad needs to be inserted at the next position
        if (adCount < config.maxAd && index === nextAdIndex) {
            if (window.top.storyAd && !window.top.storyAd.viewed) {
                insertAdStory(index + 1);
            }
            nextAdIndex = currentStory + config.otherAd + 1;
            adCount++;
            adRequested = false; // Reset adRequested for the next ad
        }

        displayStory(index);

        // Request the next ad if it's time to preload
        if (!adRequested && (currentStory + config.preload >= nextAdIndex || currentStory === 0) && adCount < config.maxAd) {
            requestAd();
            adRequested = true;
        }

        // Dispatch storyChanged event to trigger preload check
        document.dispatchEvent(new Event('storyChanged'));
    }

    function displayStory(index) {
        stories.forEach((story, i) => {
            story.style.display = (i === index) ? 'block' : 'none';
        });
        storyViewer.style.display = 'flex';

        const currentStoryElement = stories[index];
        const currentMedia = currentStoryElement.querySelector('video');
        if (currentMedia) {
            currentMedia.currentTime = 0;
            currentMedia.play();
            currentStoryElement.querySelector('.progress-bar').style.width = '0%';
            currentMedia.addEventListener('loadedmetadata', () => {
                const duration = currentMedia.duration * 1000;
                currentStoryElement.dataset.duration = duration;
                startProgress(index);
            });

            currentMedia.addEventListener('timeupdate', () => {
                if (!isPaused) {
                    const duration = currentMedia.duration * 1000;
                    const currentTime = currentMedia.currentTime * 1000;
                    const progress = (currentTime / duration) * 100;
                    currentStoryElement.querySelector('.progress-bar').style.width = `${progress}%`;
                }
            });

            currentMedia.addEventListener('ended', () => {
                clearInterval(progressInterval);
                if (currentStory < stories.length - 1) {
                    currentStory++;
                    showStory(currentStory);
                } else {
                    hideViewer();
                }
            });
        } else {
            startProgress(index);
        }
    }

    function insertAdStory(index) {
        const adStoryElement = document.createElement('div');
        adStoryElement.classList.add('story', 'advertisement-story');
        adStoryElement.dataset.duration = '5000';
        adStoryElement.dataset.category = 'advertisement';
        adStoryElement.innerHTML = `
            <div class="progress-bar"></div>
            <div class="media-container">
                <img src="${window.top.storyAd.imageUrl}" alt="Advertisement Image">
                <div class="navigation">
                    <div class="nav-left"></div>
                    <div class="nav-right"></div>
                </div>
            </div>
            <div class="category-indicator">Advertisement</div>
            <button class="close-btn">&times;</button>
            <button class="cta-btn">${window.top.storyAd.ctaText}</button>
            <button class="pause-resume-btn">Pause</button>
        `;
        adStoryElement.querySelector('.cta-btn').onclick = () => {
            window.open(window.top.storyAd.ctaUrl, '_blank');
        };
    
        storiesContainer.insertBefore(adStoryElement, stories[index]);
        window.top.storyAd.viewed = true;
    
        stories = document.querySelectorAll('.story');
    
        adStoryElement.querySelector('.nav-left').addEventListener('click', () => {
            if (currentStory > 0) {
                currentStory--;
                showStory(currentStory);
            } else {
                restartStory();
            }
        });
        adStoryElement.querySelector('.nav-right').addEventListener('click', () => {
            if (currentStory < stories.length - 1) {
                currentStory++;
                showStory(currentStory);
            } else {
                hideViewer();
            }
        });
    
        // Add pause/resume functionality for the ad story
        adStoryElement.querySelector('.pause-resume-btn').addEventListener('click', () => {
            if (isPaused) {
                resumeProgress();
                adStoryElement.querySelector('.pause-resume-btn').textContent = 'Pause';
            } else {
                pauseProgress();
                adStoryElement.querySelector('.pause-resume-btn').textContent = 'Resume';
            }
        });
    
        // Add close button functionality for the ad story
        adStoryElement.querySelector('.close-btn').addEventListener('click', () => {
            hideViewer();
        });
    }
    

    let adSlot;

    function requestAd() {
        googletag.cmd.push(function() {
            if (!adSlot) {
                adSlot = googletag.defineOutOfPageSlot('/6582/tmg.telegraph.test', 'div-gpt-adtech')
                .addService(googletag.pubads()
                .setTargeting("test", "stories")
                .setTargeting("div", "div-gpt-adtech")
            );
                
            }
            googletag.pubads().refresh([adSlot]);
        });
    }
    
    function restartStory() {
        showStory(currentStory);
    }

    function startProgress(index) {
        const story = stories[index];
        const progressBar = story.querySelector('.progress-bar');
        const duration = parseInt(story.dataset.duration);
        let width = progressBarWidth;
        progressBar.style.width = width + '%';
        const increment = 100 / (duration / 50);

        if (story.querySelector('video')) {
            const video = story.querySelector('video');
            progressInterval = setInterval(() => {
                if (!isPaused) {
                    const currentTime = video.currentTime * 1000;
                    const duration = video.duration * 1000;
                    if (currentTime >= duration) {
                        clearInterval(progressInterval);
                        if (currentStory < stories.length - 1) {
                            currentStory++;
                            showStory(currentStory);
                        } else {
                            hideViewer();
                        }
                    } else {
                        const progress = (currentTime / duration) * 100;
                        progressBar.style.width = `${progress}%`;
                    }
                }
            }, 50);
        } else {
            progressInterval = setInterval(() => {
                if (!isPaused) {
                    if (width >= 100) {
                        clearInterval(progressInterval);
                        if (currentStory < stories.length - 1) {
                            currentStory++;
                            showStory(currentStory);
                        } else {
                            hideViewer();
                        }
                    } else {
                        width += increment;
                        progressBar.style.width = width + '%';
                    }
                }
            }, 50);
        }
    }

    function pauseProgress() {
        isPaused = true;
        const story = stories[currentStory];
        const progressBar = story.querySelector('.progress-bar');
        progressBarWidth = parseFloat(progressBar.style.width);
        clearInterval(progressInterval);

        const currentMedia = story.querySelector('video');
        if (currentMedia) {
            currentMedia.pause();
        }
    }

    function resumeProgress() {
        isPaused = false;
        startProgress(currentStory);

        const currentMedia = stories[currentStory].querySelector('video');
        if (currentMedia) {
            currentMedia.play();
        }
    }

    function hideViewer() {
        storyViewer.style.display = 'none';
        clearInterval(progressInterval);
        isPaused = false;
        progressBarWidth = 0;

        const currentMedia = stories[currentStory].querySelector('video');
        if (currentMedia) {
            currentMedia.pause();
        }
    }

    // Add drag functionality for story thumbnails
    const thumbnailContainers = document.querySelectorAll('.thumbnails-container');

    thumbnailContainers.forEach(container => {
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1;
            container.scrollLeft = scrollLeft - walk;
        });

        container.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('touchend', () => {
            isDragging = false;
        });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const x = e.touches[0].pageX - container.offsetLeft;
            const walk = (x - startX) * 1;
            container.scrollLeft = scrollLeft - walk;
        });
    });

    function checkAdRequest() {
        if (!adRequested && currentStory + config.preload >= nextAdIndex && adCount < config.maxAd) {
            requestAd();
            adRequested = true;
        }
    }

    // Initial ad request check based on preload configuration
    if (config.preload > 0 && currentStory > 0) {
        requestAd();
        adRequested = true;
    }

    // Check if an ad request is needed when story changes
    document.addEventListener('storyChanged', function() {
        if (!adRequested && (currentStory + config.preload >= nextAdIndex || currentStory === 0) && adCount < config.maxAd) {
            requestAd();
            adRequested = true;
        }
    });

});