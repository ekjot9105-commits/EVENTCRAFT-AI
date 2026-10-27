import { Link } from 'react-router-dom';
import Card from '../../shared/components/Card';
import Icon, { type IconName } from '../../shared/components/Icon';
import Button from '../../shared/components/Button';

/** Honest route-level state for features whose persistence is not implemented yet. */
interface FeaturePlaceholderProps {
  title: string;
  description: string;
  icon: IconName;
}

export default function FeaturePlaceholder({ title, description, icon }: FeaturePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">Planned workspace</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{description}</p>
      <Card className="mt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300">
          <Icon name={icon} className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-surface-100">Coming in a later phase</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-surface-400">
          This route is intentionally visible so the product direction is clear. It will become functional after its persistence and validation layer is implemented.
        </p>
        <Link to="/" className="mt-6 inline-flex">
          <Button type="button" variant="secondary">Back to dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
