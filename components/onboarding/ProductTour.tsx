"use client";
import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function ProductTour({ alwaysShow = false }: { alwaysShow?: boolean }) {
    useEffect(() => {
        // Check if usage has been seen
        const hasSeenTour = localStorage.getItem("hasSeenTour");
        if (!alwaysShow && hasSeenTour) return;

        const tour = driver({
            showProgress: true,
            animate: true,
            doneBtnText: 'Finish',
            nextBtnText: 'Next',
            prevBtnText: 'Back',
            steps: [
                {
                    element: 'aside',
                    popover: {
                        title: 'Navigation',
                        description: 'Access your Dashboard, Projects, and Tasks here. Hover to expand!'
                    }
                },
                {
                    element: '.group\\/search', // Escaped class selector
                    popover: {
                        title: 'Quick Search',
                        description: 'Click here or press CMD+K / CTRL+K to search anything instantly.'
                    }
                },
                {
                    element: '#kanban-board', // We need to add this ID to kanban board wrapper
                    popover: {
                        title: 'Interactive Kanban',
                        description: 'Drag and drop tasks to update their status in real-time.'
                    }
                }
            ],
            onDestroyed: () => {
                localStorage.setItem("hasSeenTour", "true");
            }
        });

        // Small delay to ensure render
        setTimeout(() => {
            tour.drive();
        }, 1500);

        // Expose for manual trigger
        (window as any).startTour = () => {
            localStorage.removeItem("hasSeenTour");
            tour.drive();
        };

        return () => {
            tour.destroy();
        };
    }, []);

    return null; // Headless component
}
