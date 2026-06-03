import numpy as np
from PIL import Image

imgs = [
    np.asarray(
        Image.open(f"./synthetic_images_notched_size_elt_1_time_step_{i}.png").convert(
            "L"
        )
    )
    for i in range(1, 51)
]

arr = np.stack(imgs, axis=-1).astype(np.uint8)
# print(arr.shape)
# a = np.zeros((1200, 1200, 50))


np.save("images.npy", arr)
