import { LoginModalDialog } from "./LoginModal.sections";
import {
  useLoginModalModel,
  type LoginModalProps,
} from "./loginModal.model";
export default function LoginModal(props: LoginModalProps) {
  const model = useLoginModalModel(props);
  return <LoginModalDialog model={model} />;
}
