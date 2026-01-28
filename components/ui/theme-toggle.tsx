import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Check for saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        setIsDark(shouldBeDark);

        if (shouldBeDark) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);

        if (newIsDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative overflow-hidden group"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-info/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
            {isDark ? (
                <Sun className="h-5 w-5 relative z-10 text-yellow-500 transition-transform group-hover:rotate-45" />
            ) : (
                <Moon className="h-5 w-5 relative z-10 transition-transform group-hover:-rotate-12" />
            )}
        </Button>
    );
}
