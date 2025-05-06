document.addEventListener('DOMContentLoaded', () => {
    // 主题切换
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle.querySelector('i');
    
    // 设置默认主题为暗色模式
    document.documentElement.setAttribute('data-theme', 'dark');
    icon.classList.replace('fa-moon', 'fa-sun');
    localStorage.setItem('theme', 'dark');

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'dark');
        }
    });

    // 搜索功能
    const searchInput = document.getElementById('search');
    const linkCards = document.querySelectorAll('.link-card');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        linkCards.forEach(card => {
            const text = card.querySelector('span').textContent.toLowerCase();
            const category = card.closest('.category');
            
            if (text.includes(searchTerm)) {
                card.style.display = 'flex';
                category.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // 隐藏空分类
        document.querySelectorAll('.category').forEach(category => {
            const visibleCards = category.querySelectorAll('.link-card[style="display: flex"]');
            if (visibleCards.length === 0) {
                category.style.display = 'none';
            }
        });
    });
}); 