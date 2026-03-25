interface SectionHeaderProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

const SectionHeader = ({ title, description, icon }: SectionHeaderProps) => (
  <div className="space-y-1 mb-4">
    <h3 className="text-lg font-display flex items-center gap-2">
      {icon}
      {title}
    </h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default SectionHeader;
