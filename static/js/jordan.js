// https://www.bram.us/2020/01/10/smooth-scrolling-sticky-scrollspy-navigation/
// BUGS:
// h1 has no id so it is never highlighted
// pelican does not add any <section> so we should in fact be monitoring section
// because now when the header gets out of view, no element in the toc is
// active...
window.addEventListener('DOMContentLoaded', () => {

	const observer = new IntersectionObserver(entries => {
                console.log("changed");
		entries.forEach(entry => {
			const id = entry.target.getAttribute('id');
                        console.log(id);
			if (entry.intersectionRatio > 0) {
				elt = document.querySelector(`#toc a[href="#${id}"]`);
                                if (elt)
                                    elt.parentElement.classList.add('active');
			} else {
				elt = document.querySelector(`#toc a[href="#${id}"]`);
                                if (elt)
                                    elt.parentElement.classList.remove('active');
			}
		});
	});

	// Track all sections that have an `id` applied
        console.log("observing");
	document.querySelectorAll('h1, h2, h3, h4').forEach((elt) => {
                console.log(elt);
		observer.observe(elt);
	});
});
