import { useParams } from "react-router-dom";

export default function EditorPage() {
  const { projectId } = useParams();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Deck Editor</h1>
      <p className="text-text-secondary">Project: {projectId}</p>
    </div>
  );
}
