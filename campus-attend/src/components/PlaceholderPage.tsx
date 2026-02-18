interface PlaceholderPageProps {
    title: string;
    description?: string;
    icon?: string;
}

export default function PlaceholderPage({
    title,
    description = 'This page is coming soon.',
    icon = '🚧',
}: PlaceholderPageProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
            <span className="text-5xl">{icon}</span>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 max-w-sm">{description}</p>
        </div>
    );
}
