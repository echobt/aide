import { Show } from "solid-js";
import { tokens } from "@/design-system/tokens";
import {
  Button,
  Input,
  Text,
  Modal,
} from "@/components/ui";
import type { GitTag } from "@/utils/tauri-api";

export interface DeleteTagModalProps {
  tag: GitTag | null;
  deleteRemoteToo: boolean;
  operationLoading: string | null;
  onClose: () => void;
  onDelete: (tag: GitTag, deleteRemote: boolean) => void;
  onDeleteRemoteToggle: (checked: boolean) => void;
}

export function DeleteTagModal(props: DeleteTagModalProps) {
  return (
    <Modal
      open={!!props.tag}
      onClose={props.onClose}
      title="Delete Tag"
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => props.onDelete(props.tag!, props.deleteRemoteToo)}
            loading={props.operationLoading?.startsWith("delete-")}
            style={{ background: tokens.colors.semantic.error }}
          >
            Delete
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
        <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
          Are you sure you want to delete tag <strong>{props.tag?.name}</strong>?
        </Text>

        <Show when={props.tag?.isPushed}>
          <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={props.deleteRemoteToo}
              onChange={(e) => props.onDeleteRemoteToggle(e.currentTarget.checked)}
              style={{
                width: "16px",
                height: "16px",
                cursor: "pointer",
              }}
            />
            <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
              Also delete from remote
            </Text>
          </label>
        </Show>

        <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
          This action cannot be undone.
        </Text>
      </div>
    </Modal>
  );
}

export interface CreateBranchModalProps {
  tag: GitTag | null;
  branchName: string;
  operationLoading: string | null;
  onClose: () => void;
  onCreateBranch: () => void;
  onBranchNameChange: (name: string) => void;
}

export function CreateBranchModal(props: CreateBranchModalProps) {
  return (
    <Modal
      open={!!props.tag}
      onClose={props.onClose}
      title="Create Branch from Tag"
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={props.onCreateBranch}
            disabled={!props.branchName.trim()}
            loading={props.operationLoading?.startsWith("branch-")}
          >
            Create Branch
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
        <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
          Create a new branch from tag <strong>{props.tag?.name}</strong>
        </Text>

        <Input
          label="Branch Name"
          placeholder="Enter branch name..."
          value={props.branchName}
          onInput={(e) => props.onBranchNameChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && props.branchName.trim()) {
              props.onCreateBranch();
            }
          }}
          autofocus
        />
      </div>
    </Modal>
  );
}
