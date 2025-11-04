
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('section');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    sections.forEach((section, index) => {
        if (index % 2 === 0) {
            section.classList.add('slide-in-left');
        } else {
            section.classList.add('slide-in-right');
        }
        observer.observe(section);
    });

    // Parallax effect on scroll
    window.addEventListener('scroll', () => {
        const scrolledY = window.scrollY;
        document.body.style.setProperty('--parallax-y', `-${scrolledY * 0.1}px`);
    });
});
