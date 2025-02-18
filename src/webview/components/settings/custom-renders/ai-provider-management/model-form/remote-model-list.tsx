import type { AIModel, AIModelFeature } from '@shared/entities'
import { CardList } from '@webview/components/ui/card-list'
import { Switch } from '@webview/components/ui/switch'

import { ModelFeatureList } from './model-feature-list'
import { ModelItem } from './model-item'

interface RemoteModelListProps {
  models: AIModel[]
  manualModelNames: string[]
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  onTestModelFeatures: (model: AIModel, features: AIModelFeature[]) => void
  onAddToManual: (model: AIModel) => void
  onRemoveFromManual: (model: AIModel) => void
  headerLeftActions?: React.ReactNode
}

export const RemoteModelList = ({
  models,
  manualModelNames,
  enabled,
  onEnabledChange,
  onTestModelFeatures,
  onAddToManual,
  onRemoveFromManual,
  headerLeftActions
}: RemoteModelListProps) => (
  <CardList
    idField="id"
    items={models}
    title="Remote Models"
    draggable={false}
    selectable={false}
    expandable
    headerLeftActions={headerLeftActions}
    minCardWidth={200}
    headerRightActions={
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
    }
    renderCard={({ item: model }) => (
      <ModelItem
        model={model}
        isRemote
        onAddToManual={onAddToManual}
        onRemoveFromManual={onRemoveFromManual}
        isAdded={manualModelNames.includes(model.name)}
      />
    )}
    renderExpandedContent={model => (
      <ModelFeatureList
        model={model}
        onTestModelFeatures={onTestModelFeatures}
      />
    )}
  />
)
